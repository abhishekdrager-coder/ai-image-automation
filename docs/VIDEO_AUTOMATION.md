# Video Automation Guide

## Goal

Automate this chain in one run:

1. Script generation
2. Transcript ingestion (TurboScribe API or file export)
3. Frame-by-frame image generation with Freegen
4. Timestamped timeline creation
5. ffmpeg video assembly
6. Optional social uploads

## Commands

Generate a script only:

```bash
npm run video:script -- --topic "How to automate reels" --durationSec 60
```

Run full pipeline:

```bash
npm run video:build -- --job inputs/video-job.json
```

Run full pipeline with direct args:

```bash
npm run video:build -- \
  --topic "How to automate reels" \
  --audio outputs/audio/voice.mp3 \
  --transcript inputs/transcript.srt \
  --preset cinematic
```

## Input file

`inputs/video-job.json`

```json
{
  "topic": "How to automate short-form educational videos",
  "audience": "new creators building faceless content channels",
  "tone": "confident, practical, clear",
  "durationSec": 65,
  "preset": "cinematic",
  "visualStyle": "high-contrast cinematic realism, dramatic light, sharp subject focus",
  "audioPath": "",
  "transcriptPath": "",
  "publish": false,
  "publishTargets": "youtube,facebook,instagram,webhook",
  "publishTitle": "How to automate shorts with AI",
  "publishDescription": "Automated pipeline from script to publish-ready video.",
  "publishTags": ["automation", "ai", "shorts"],
  "youtubePrivacyStatus": "private"
}
```

## Transcript flow

Priority order:

1. `transcriptPath` (supports `.srt`, `.vtt`, `.txt`, `.json`)
2. TurboScribe API if configured and `audioPath` is present
3. Script-text fallback segmentation

## Environment variables

See `.env.example` for complete list. The main groups are:

- Freegen provider (`FREEGEN_*`)
- Video rendering (`VIDEO_*`)
- TurboScribe (`TURBOSCRIBE_*`)
- Auto publish (`YOUTUBE_*`, `FACEBOOK_*`, `INSTAGRAM_*`, `SOCIAL_WEBHOOK_URLS`)

## Output folders

- `outputs/video-scripts/` generated narration scripts
- `outputs/video-runs/<runId>/` run-specific script/transcript/timeline/images
- `outputs/videos/` final mp4 output

## ffmpeg requirement

Video assembly requires:

- `ffmpeg`
- `ffprobe`

If they are missing, the pipeline will fail with a clear error and still preserve generated script/transcript/image artifacts.

## Social publishing caveats

- YouTube upload requires a valid OAuth access token with upload scope.
- Facebook upload requires a page ID and page token with video publish permission.
- Instagram publishing requires a public video URL and Graph API permissions.
- Webhooks can be used as a generic extension point for any additional platform.
