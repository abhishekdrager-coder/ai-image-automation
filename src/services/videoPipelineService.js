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

const PLACEHOLDER_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aRsAAAAASUVORK5CYII=';

async function ensureFallbackImage(imagePath) {
  const buffer = Buffer.from(PLACEHOLDER_PNG_BASE64, 'base64');
  await writeFile(imagePath, buffer);
}

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

function buildVisualBible({ topic, audience, preset, totalSegments }) {
  const safeTopic = toSafeSentence(topic || 'the story');
  const safeAudience = toSafeSentence(audience || 'the intended audience');
  const safePreset = toSafeSentence(preset || 'cinematic');

  return {
    subject: `A single connected visual story about ${safeTopic}`,
    scene: `Every frame belongs to the same world and should visually evolve without changing the core identity.`,
    composition: `Maintain a stable visual language across ${totalSegments} frames with consistent framing, subject scale, and spatial logic.`,
    camera: `Keep the same general camera family throughout the sequence with only subtle changes in angle or distance when the story needs emphasis.`,
    lighting: `Preserve the same lighting mood, contrast level, and color temperature across every image.`,
    color: `Use one coherent palette that matches ${safeAudience} and stays recognizable from frame to frame.`,
    style: `Apply the ${safePreset} preset consistently so the series looks like one intentional visual set, not separate unrelated images.`,
    quality: `Highly detailed storyboard frame, consistent subject identity, consistent wardrobe and environment logic, strong continuity, no random style drift.`,
    extraDirectives: [
      `Continuity rule: keep the same main subject, same visual identity, same palette, and same art direction across every image.`,
      `Do not introduce random new characters, random props, sudden outfit changes, or abrupt environment changes unless the story explicitly requires it.`,
      `Each image should feel like the next panel in a connected storyboard and should visually correlate with the previous and next frames.`,
      `Audience focus: ${safeAudience}.`,
      `Overall project focus: ${safeTopic}.`,
    ],
    negative: [
      'inconsistent style',
      'random characters',
      'sudden wardrobe change',
      'mismatched lighting',
      'different art direction',
      'visual drift',
      'unrelated scene',
      'incoherent framing',
    ],
  };
}

function segmentToImagePrompt({ topic, audience, segment, preset, bible, previousSegment, nextSegment, index, totalSegments }) {
  const narration = toSafeSentence(segment.text);
  const locationHint = toSafeSentence(segment.locationHint || 'the same visual world as the rest of the sequence');
  const beatRole = index === 0
    ? 'Establish the world clearly.'
    : index === totalSegments - 1
      ? 'Resolve the visual story while keeping the same identity.'
      : 'Advance the story while preserving continuity with surrounding frames.';

  const continuityNotes = [
    `Current beat: ${narration}`,
    previousSegment ? `Previous beat for continuity: ${toSafeSentence(previousSegment.text)}` : 'This is the opening frame, so establish the shared world and visual identity clearly.',
    nextSegment ? `Next beat for continuity: ${toSafeSentence(nextSegment.text)}` : 'This is the closing frame, so keep the final image visually tied to the shared story world.',
    `This frame must fit the same story bible as the rest of the sequence and must not feel like a different project.`,
    `Frame role: ${beatRole}`,
  ];

  return {
    subject: bible.subject,
    scene: `${narration}. ${locationHint}`,
    composition: bible.composition,
    camera: bible.camera,
    lighting: bible.lighting,
    color: bible.color,
    style: bible.style,
    quality: bible.quality,
    extraDirectives: [...bible.extraDirectives, ...continuityNotes],
    preset,
    negative: bible.negative,
  };
}

async function generateImagesForSegments({ topic, audience, segments, outputImageDir, preset, dryRunImages }) {
  const results = [];
  const bible = buildVisualBible({ topic, audience, preset, totalSegments: segments.length });

  for (const [index, segment] of segments.entries()) {
    const promptPayload = segmentToImagePrompt({
      topic,
      audience,
      segment,
      preset,
      bible,
      previousSegment: segments[index - 1] || null,
      nextSegment: segments[index + 1] || null,
      index,
      totalSegments: segments.length,
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
    } else {
      const fallbackPath = path.join(
        outputImageDir,
        `${String(segment.id).padStart(3, '0')}_${formatTime(segment.startSec)}_${slugify(topic)}.png`,
      );
      await ensureFallbackImage(fallbackPath);
      imagePath = fallbackPath;
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
    audience: input.audience,
    segments: transcript.segments,
    outputImageDir: imageDir,
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
