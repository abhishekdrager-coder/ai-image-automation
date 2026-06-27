import path from 'node:path';
import { config } from '../config.js';
import { ensureDir, readJsonFile, writeJsonFile } from '../utils/fileUtils.js';

const indexPath = path.join(config.output.metadataDir, 'index.json');

function toIndexRecord(metadata) {
  return {
    runId: metadata.runId,
    timestamp: metadata.timestamp,
    provider: metadata.provider,
    success: metadata.success,
    subject: metadata.inputPayload?.subject || null,
    preset: metadata.inputPayload?.preset || null,
    localImagePath: metadata.output?.localImagePath || null,
    remoteImageUrl: metadata.output?.remoteImageUrl || null,
    durationMs: metadata.durationMs,
    error: metadata.error?.message || null,
  };
}

export async function ensureMetadataStorage() {
  await ensureDir(config.output.metadataDir);
  await ensureDir(config.output.artifactDir);
  const existing = await readJsonFile(indexPath, null);
  if (existing === null) {
    await writeJsonFile(indexPath, []);
  }
}

export async function saveMetadataRecord(metadata) {
  await ensureMetadataStorage();
  const metadataPath = path.join(config.output.metadataDir, `${metadata.runId}.json`);
  await writeJsonFile(metadataPath, metadata);

  const index = await readJsonFile(indexPath, []);
  index.push(toIndexRecord(metadata));
  await writeJsonFile(indexPath, index);

  return metadataPath;
}

export async function saveArtifact(runId, name, payload) {
  await ensureMetadataStorage();
  const artifactPath = path.join(config.output.artifactDir, `${runId}-${name}.json`);
  await writeJsonFile(artifactPath, payload);
  return artifactPath;
}

export async function getHistory(limit = 20) {
  const index = await readJsonFile(indexPath, []);
  return index.slice(-limit).reverse();
}

export async function getRunById(runId) {
  const metadataPath = path.join(config.output.metadataDir, `${runId}.json`);
  return readJsonFile(metadataPath, null);
}
