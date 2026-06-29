# ai-image-automation

This repository now supports a complete creator pipeline:

- Script generation
- Transcript ingestion (TurboScribe API or exported transcript file)
- Prompted image generation via Freegen
- Timestamped image timeline creation
- Video assembly with ffmpeg in one command
- Optional auto-publishing to YouTube, Facebook, Instagram, and webhooks

## Recommended deployment path

For your use case (frequent recording + fast exports), the best first step is a **local CLI pipeline**.
It is faster to iterate, easier to debug, and has direct access to audio/video files and ffmpeg.
After this is stable, wrap it with a lightweight web UI if needed.

## Prerequisites

1. Node.js 20+
2. ffmpeg and ffprobe installed on your machine
3. Freegen endpoint in `.env`
4. Optional social/API credentials for publishing

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env
```

3. Configure at minimum:

- `FREEGEN_API_URL`
- Optional `FREEGEN_API_KEY`

4. Optional for transcription:

- `TURBOSCRIBE_API_URL`
- `TURBOSCRIBE_API_KEY`

5. Optional for auto publish:

- `YOUTUBE_ACCESS_TOKEN`
- `FACEBOOK_PAGE_ID`, `FACEBOOK_ACCESS_TOKEN`
- `INSTAGRAM_USER_ID`, `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_VIDEO_PUBLIC_URL`

## Core commands

- `npm run dev`
- `npm start`
- `npm run smoke`
- `npm run generate -- --subject "robot barista" --scene "busy cafe" --preset cinematic --dryRun`
- `npm run generate:batch`
- `npm run video:script -- --topic "How to automate short-form videos" --durationSec 60`
- `npm run video:build -- --job inputs/video-job.json`

## One-command full video build

Use the job file at `inputs/video-job.json`.

```bash
npm run video:build -- --job inputs/video-job.json
```

Useful overrides:

```bash
npm run video:build -- \
  --topic "Automate your shorts workflow" \
  --audio outputs/audio/voice.mp3 \
  --transcript inputs/my-transcript.srt \
  --preset cinematic \
  --publish \
  --publishTargets youtube,facebook,instagram
```

Pipeline output artifacts:

- Script: `outputs/video-runs/<runId>/script/<runId>.md`
- Transcript JSON: `outputs/video-runs/<runId>/transcript/<runId>.json`
- Timestamped images: `outputs/video-runs/<runId>/images/`
- Video output: `outputs/videos/<runId>.mp4`
- Summary: `outputs/video-runs/<runId>/summary.json`

## TurboScribe integration notes

The pipeline supports:

1. Transcript file export import (`.srt`, `.vtt`, `.txt`, `.json`) via `transcriptPath`
2. Direct API transcription if `TURBOSCRIBE_API_URL` and `TURBOSCRIBE_API_KEY` are configured

If neither transcript nor TurboScribe API is available, the script text is used as fallback segments.

## Publishing notes

- YouTube upload uses OAuth access token (`YOUTUBE_ACCESS_TOKEN`)
- Facebook upload posts to a page video endpoint
- Instagram publish uses Graph API and requires a public video URL
- Webhooks allow custom fan-out to additional systems

## Project structure

- API and image generation: `src/`
- Video orchestration script: `scripts/createVideo.js`
- Script-only generator: `scripts/generateScript.js`
- Pipeline services: `src/services/*video*`
- Extended docs: `docs/API.md`, `docs/PROMPTS.md`, `docs/OPERATIONS.md`
