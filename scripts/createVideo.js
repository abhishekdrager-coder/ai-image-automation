#!/usr/bin/env node
import path from 'node:path';
import { readJsonFile } from '../src/utils/fileUtils.js';
import { runVideoPipeline } from '../src/services/videoPipelineService.js';

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];

    if (next && !next.startsWith('--')) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function loadJob(jobPath) {
  if (!jobPath) {
    return {};
  }

  const absolute = path.resolve(jobPath);
  const job = await readJsonFile(absolute, null);
  if (!job) {
    throw new Error(`Job file not found: ${absolute}`);
  }

  return job;
}

function printHelp() {
  console.log(`Usage:
  npm run video:build -- --job inputs/video-job.json

Common flags:
  --topic "Topic title"
  --audio outputs/audio/my-recording.mp3
  --transcript inputs/transcript.srt
  --durationSec 60
  --preset cinematic
  --dryRunImages
  --skipVideoBuild
  --publish
  --publishTargets youtube,facebook,instagram,webhook

Notes:
  - If transcript is omitted, the pipeline can use TurboScribe API (if configured) or script fallback segmentation.
  - ffmpeg and ffprobe are required when video build is enabled.
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const job = await loadJob(args.job || 'inputs/video-job.json').catch(() => ({}));

  const pipelineInput = {
    ...job,
    topic: args.topic || job.topic,
    title: args.title || job.title,
    audience: args.audience || job.audience,
    tone: args.tone || job.tone,
    callToAction: args.callToAction || job.callToAction,
    scriptText: args.scriptText || job.scriptText,
    scriptProvider: args.scriptProvider || job.scriptProvider,
    scriptModel: args.scriptModel || job.scriptModel,
    durationSec: toNumber(args.durationSec, toNumber(job.durationSec, 60)),
    audioPath: args.audio || job.audioPath,
    transcriptPath: args.transcript || job.transcriptPath,
    language: args.language || job.language || 'en',
    preset: args.preset || job.preset,
    dryRunImages: Boolean(args.dryRunImages || job.dryRunImages),
    skipVideoBuild: Boolean(args.skipVideoBuild || job.skipVideoBuild),
    publish: Boolean(args.publish || job.publish),
    publishTargets: args.publishTargets || job.publishTargets,
    publishTitle: args.publishTitle || job.publishTitle,
    publishDescription: args.publishDescription || job.publishDescription,
    publishTags: args.publishTags
      ? String(args.publishTags).split(',').map((item) => item.trim()).filter(Boolean)
      : job.publishTags,
    youtubePrivacyStatus: args.youtubePrivacyStatus || job.youtubePrivacyStatus,
  };

  const result = await runVideoPipeline(pipelineInput);
  console.log(JSON.stringify({ ok: true, data: result }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: {
      code: error.code || 'VIDEO_PIPELINE_ERROR',
      message: error.message,
      details: error.details || null,
    },
  }, null, 2));
  process.exitCode = 1;
});
