#!/usr/bin/env node
import { createImageRun } from '../src/services/imageGenerationService.js';

function parseArgs(argv) {
  const result = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const nextValue = argv[index + 1];

    if (nextValue && !nextValue.startsWith('--')) {
      result[key] = nextValue;
      index += 1;
    } else {
      result[key] = true;
    }
  }

  return result;
}

const rawArgs = parseArgs(process.argv.slice(2));
const payload = {
  subject: rawArgs.subject,
  scene: rawArgs.scene,
  preset: rawArgs.preset,
  size: rawArgs.size,
  composition: rawArgs.composition,
  camera: rawArgs.camera,
  lens: rawArgs.lens,
  lighting: rawArgs.lighting,
  color: rawArgs.color,
  style: rawArgs.style,
  mood: rawArgs.mood,
  quality: rawArgs.quality,
  aspectRatio: rawArgs.aspectRatio,
  prompt: rawArgs.prompt,
  dryRun: Boolean(rawArgs.dryRun),
};

try {
  const result = await createImageRun(payload);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    error: {
      code: error.code || 'CLI_ERROR',
      message: error.message,
      details: error.details || null,
    },
  }, null, 2));
  process.exitCode = 1;
}
