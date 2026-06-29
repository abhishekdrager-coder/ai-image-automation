import path from 'node:path';
import { copyFile, writeFile } from 'node:fs/promises';
import { config } from '../config.js';
import { createImageRun } from './imageGenerationService.js';
import { generateNarrationScript, scriptToSegments } from './scriptGenerationService.js';
import { resolveTranscript } from './transcriptionService.js';
import { buildVideoFromTimeline, getMediaDurationSec } from './videoCompositionService.js';
import { publishVideo } from './socialPublishService.js';
import { ensureDir, slugify, writeJsonFile } from '../utils/fileUtils.js';
import { getCompactTimestamp, getIsoTimestamp } from '../utils/timeUtils.js';

function toSafeSentence(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds || 0)));
  const hours = String(Math.floor(total / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const secs = String(total % 60).padStart(2, '0');
  return `${hours}-${minutes}-${secs}`;
}

function getSegmentDuration(segment) {
  if (Number.isFinite(segment.endSec) && Number.isFinite(segment.startSec)) {
    return Math.max(1, Math.round(segment.endSec - segment.startSec));
  }

  return 4;
}

function segmentToImagePrompt({ topic, segment, visualStyle, preset }) {
  const narration = toSafeSentence(segment.text);
  const style = toSafeSentence(visualStyle || 'cinematic realism, rich detail, storytelling frame');
  const locationHint = toSafeSentence(segment.locationHint || 'contextual background matching narration');
  const subject = toSafeSentence(topic || 'story scene');

  return {
    subject,
    scene: `${narration}. ${locationHint}`,
    style,
    preset,
    quality: 'high detail, clean composition, no text overlay, no watermark',
    negative: [
      'text overlay',
      'caption',
      'watermark',
      'blurry',
      'distorted face',
    ],
  };
}

async function generateImagesForSegments({ topic, segments, outputImageDir, visualStyle, preset, dryRunImages }) {
  const results = [];

  for (const segment of segments) {
    const promptPayload = segmentToImagePrompt({
      topic,
      segment,
      visualStyle,
      preset,
    });

    const generation = await createImageRun({
      ...promptPayload,
      dryRun: Boolean(dryRunImages),
    });

    const createdPath = generation?.data?.output?.localImagePath || null;
    let imagePath = createdPath;

    if (imagePath) {
      const renamed = path.join(
        outputImageDir,
        `${String(segment.id).padStart(3, '0')}_${formatTime(segment.startSec)}_${slugify(topic)}.png`,
      );
      await copyFile(imagePath, renamed);
      imagePath = renamed;
    }

    results.push({
      segmentId: segment.id,
      startSec: segment.startSec,
      endSec: segment.endSec,
      durationSec: getSegmentDuration(segment),
      imagePath,
      runId: generation?.data?.runId || null,
      prompt: generation?.data?.finalPrompt || null,
      success: generation?.data?.success || false,
      dryRun: generation?.data?.dryRun || false,
    });
  }

  return results;
}

function parseTargets(targetString) {
  if (!targetString) {
    return [];
  }

  return String(targetString)
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export async function runVideoPipeline(input = {}) {
  const startedAt = Date.now();
  const runStamp = getCompactTimestamp();
  const topic = toSafeSentence(input.topic || input.title || 'untitled story');
  const slug = slugify(topic);
  const runId = `video_${runStamp}_${slug}`;

  const runDir = path.join(config.output.videoRunDir, runId);
  const imageDir = path.join(runDir, 'images');
  const transcriptDir = path.join(runDir, 'transcript');
  const scriptDir = path.join(runDir, 'script');
  const timelineDir = path.join(runDir, 'timeline');

  await ensureDir(runDir);
  await ensureDir(imageDir);
  await ensureDir(transcriptDir);
  await ensureDir(scriptDir);
  await ensureDir(timelineDir);
  await ensureDir(config.output.videoDir);

  const generatedScript = input.scriptText
    ? {
      scriptText: input.scriptText,
      sections: scriptToSegments(input.scriptText),
      topic,
      durationSec: input.durationSec || 60,
      wordTarget: null,
    }
    : generateNarrationScript({
      topic,
      audience: input.audience,
      tone: input.tone,
      durationSec: input.durationSec,
      callToAction: input.callToAction,
    });

  const scriptPath = path.join(scriptDir, `${runId}.md`);
  await writeFile(scriptPath, `${generatedScript.scriptText}\n`, 'utf8');

  const audioDurationSec = input.audioPath ? await getMediaDurationSec(input.audioPath).catch(() => null) : null;
  const transcript = await resolveTranscript({
    transcriptPath: input.transcriptPath,
    audioPath: input.audioPath,
    fallbackScriptText: generatedScript.scriptText,
    language: input.language,
    durationSec: audioDurationSec || generatedScript.durationSec,
  });

  const transcriptPath = path.join(transcriptDir, `${runId}.json`);
  await writeJsonFile(transcriptPath, transcript);

  const imageTimeline = await generateImagesForSegments({
    topic,
    segments: transcript.segments,
    outputImageDir: imageDir,
    visualStyle: input.visualStyle,
    preset: input.preset,
    dryRunImages: input.dryRunImages,
  });

  const usableImages = imageTimeline.filter((item) => item.imagePath);
  let videoPath = null;
  let assembly = null;

  if (usableImages.length > 0 && !input.skipVideoBuild) {
    const outputVideoPath = path.join(config.output.videoDir, `${runId}.mp4`);
    videoPath = await buildVideoFromTimeline({
      timelineItems: usableImages,
      outputVideoPath,
      audioPath: input.audioPath || null,
      workingDir: timelineDir,
    });
    assembly = {
      outputVideoPath: videoPath,
      withAudio: Boolean(input.audioPath),
      frameCount: usableImages.length,
    };
  }

  let publishResults = [];
  const shouldPublish = Boolean(input.publish) || config.publish.enabledByDefault;
  if (videoPath && shouldPublish) {
    publishResults = await publishVideo(videoPath, {
      title: input.publishTitle || topic,
      description: input.publishDescription || generatedScript.scriptText,
      tags: Array.isArray(input.publishTags) ? input.publishTags : [],
      privacyStatus: input.youtubePrivacyStatus || 'private',
    }, parseTargets(input.publishTargets));
  }

  const summary = {
    ok: true,
    runId,
    timestamp: getIsoTimestamp(),
    topic,
    scriptPath,
    transcriptPath,
    runDir,
    videoPath,
    generatedScript,
    transcriptSource: transcript.source,
    segments: transcript.segments,
    imageTimeline,
    assembly,
    publishResults,
    durationMs: Date.now() - startedAt,
  };

  const summaryPath = path.join(runDir, 'summary.json');
  await writeJsonFile(summaryPath, summary);

  return {
    ...summary,
    summaryPath,
  };
}
