#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { generateVideoScript } from '../src/services/videoScriptService.js';
import { ensureDir, slugify } from '../src/utils/fileUtils.js';
import { getCompactTimestamp } from '../src/utils/timeUtils.js';

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

const args = parseArgs(process.argv.slice(2));
if (!args.topic) {
  console.error('Usage: npm run video:script -- --topic "Your topic" --audience "Your audience" [--durationSec 60] [--scriptProvider auto|claude|gpt]');
  process.exit(1);
}

const result = await generateVideoScript({
  topic: args.topic,
  audience: args.audience,
  durationSec: Number.isFinite(Number(args.durationSec)) ? Number(args.durationSec) : 60,
  provider: args.scriptProvider,
  model: args.scriptModel,
  callToAction: args.callToAction,
});

const outDir = path.resolve('outputs/video-scripts');
await ensureDir(outDir);
const outFile = path.join(outDir, `${getCompactTimestamp()}_${slugify(args.topic)}.md`);
await writeFile(outFile, `${result.scriptText}\n`, 'utf8');

console.log(JSON.stringify({
  ok: true,
  data: {
    outputFile: outFile,
    script: result.scriptText,
    sections: result.sections,
    provider: result.provider,
    model: result.model,
    fallbackUsed: result.fallbackUsed,
  },
}, null, 2));
