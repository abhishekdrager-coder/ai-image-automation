#!/usr/bin/env node
import path from 'node:path';
import { readJsonFile, writeJsonFile } from '../src/utils/fileUtils.js';
import { config } from '../src/config.js';
import { createImageBatch } from '../src/services/imageGenerationService.js';
import { getCompactTimestamp } from '../src/utils/timeUtils.js';

const batchPath = path.resolve(process.cwd(), 'inputs/batch.json');
const jobs = await readJsonFile(batchPath, null);

if (!jobs) {
  console.error(`Batch input file not found: ${batchPath}`);
  process.exit(1);
}

const tasks = Array.isArray(jobs) ? jobs : jobs.tasks;
if (!Array.isArray(tasks)) {
  console.error('Batch input must be an array or an object with a tasks array.');
  process.exit(1);
}

const summary = await createImageBatch(tasks);
const reportPath = path.join(config.output.artifactDir, `batch-summary-${getCompactTimestamp()}.json`);
await writeJsonFile(reportPath, summary);

console.log(JSON.stringify({ ok: true, data: summary, reportPath }, null, 2));
