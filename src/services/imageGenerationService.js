import path from 'node:path';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { createProvider } from '../providers/providerFactory.js';
import { buildPrompt } from './promptBuilderService.js';
import { getDurationMs, getIsoTimestamp, getCompactTimestamp } from '../utils/timeUtils.js';
import { createRunId, createShortId } from '../utils/idUtils.js';
import { ensureDir, slugify, writeBufferToFile } from '../utils/fileUtils.js';
import { saveArtifact, saveMetadataRecord } from './metadataService.js';

const sanitizeInputPayload = (payload) => ({
  subject: payload.subject || null,
  scene: payload.scene || null,
  composition: payload.composition || null,
  camera: payload.camera || null,
  lens: payload.lens || null,
  lighting: payload.lighting || null,
  color: payload.color || null,
  style: payload.style || null,
  mood: payload.mood || null,
  quality: payload.quality || null,
  aspectRatio: payload.aspectRatio || null,
  negative: payload.negative || null,
  extraDirectives: payload.extraDirectives || null,
  preset: payload.preset || null,
  prompt: payload.prompt || null,
  size: payload.size || null,
  seed: payload.seed ?? null,
  steps: payload.steps ?? null,
  cfg: payload.cfg ?? null,
  model: payload.model || null,
  dryRun: Boolean(payload.dryRun),
});

export async function createImageRun(payload) {
  const startedAt = Date.now();
  const runId = createRunId();
  const timestamp = getIsoTimestamp();

  let promptData;
  if (payload.prompt) {
    promptData = {
      finalPrompt: String(payload.prompt).trim(),
      normalizedInput: sanitizeInputPayload(payload),
      promptBreakdown: {
        subject: payload.subject || null,
        scene: payload.scene || null,
        composition: payload.composition || null,
        cameraLens: null,
        lighting: null,
        colorMood: null,
        style: null,
        quality: null,
        extraDirectives: [],
        negativePrompt: [],
        preset: payload.preset || null,
        source: 'prebuilt-prompt',
      },
    };
  } else {
    promptData = buildPrompt(payload);
  }

  if (config.prompt.enablePromptLogging) {
    logger.info('Prompt prepared', { runId, prompt: promptData.finalPrompt });
  }

  const baseMetadata = {
    runId,
    timestamp,
    provider: config.app.provider,
    inputPayload: sanitizeInputPayload(payload),
    finalPrompt: promptData.finalPrompt,
    promptBreakdown: promptData.promptBreakdown,
  };

  if (payload.dryRun) {
    const metadata = {
      ...baseMetadata,
      providerRequestSummary: null,
      providerResponseSummary: null,
      output: {
        localImagePath: null,
        remoteImageUrl: null,
        width: null,
        height: null,
      },
      durationMs: getDurationMs(startedAt),
      success: true,
      error: null,
    };

    await saveMetadataRecord(metadata);

    return {
      ok: true,
      data: {
        runId,
        finalPrompt: promptData.finalPrompt,
        output: metadata.output,
        durationMs: metadata.durationMs,
        success: true,
        dryRun: true,
      },
    };
  }

  try {
    await ensureDir(config.output.imageDir);
    const provider = createProvider();
    const providerResult = await provider.generateImage({
      prompt: promptData.finalPrompt,
      size: payload.size,
      seed: payload.seed,
      steps: payload.steps,
      cfg: payload.cfg,
      model: payload.model,
    });

    const filename = `${getCompactTimestamp()}_${createShortId()}_${slugify(payload.subject || 'image')}.png`;
    const absoluteImagePath = path.join(config.output.imageDir, filename);
    await writeBufferToFile(absoluteImagePath, providerResult.binaryBuffer);
    await saveArtifact(runId, 'provider-response', providerResult.rawResponse);

    const metadata = {
      ...baseMetadata,
      providerRequestSummary: providerResult.requestSummary,
      providerResponseSummary: providerResult.responseSummary,
      output: {
        localImagePath: absoluteImagePath,
        remoteImageUrl: providerResult.remoteImageUrl,
        width: null,
        height: null,
      },
      durationMs: getDurationMs(startedAt),
      success: true,
      error: null,
    };

    await saveMetadataRecord(metadata);

    return {
      ok: true,
      data: {
        runId,
        finalPrompt: promptData.finalPrompt,
        output: metadata.output,
        durationMs: metadata.durationMs,
        success: true,
        dryRun: false,
      },
    };
  } catch (error) {
    const metadata = {
      ...baseMetadata,
      providerRequestSummary: null,
      providerResponseSummary: null,
      output: {
        localImagePath: null,
        remoteImageUrl: null,
        width: null,
        height: null,
      },
      durationMs: getDurationMs(startedAt),
      success: false,
      error: {
        message: error.message,
        code: error.code || 'GENERATION_ERROR',
        details: error.details || null,
      },
    };

    await saveMetadataRecord(metadata);
    throw error;
  }
}

export async function createImageBatch(tasks = []) {
  const results = [];

  for (const task of tasks) {
    try {
      const result = await createImageRun(task);
      results.push(result.data);
    } catch (error) {
      results.push({
        runId: null,
        success: false,
        error: {
          message: error.message,
          code: error.code || 'BATCH_ITEM_ERROR',
        },
      });
    }
  }

  return {
    total: tasks.length,
    successful: results.filter((item) => item.success).length,
    failed: results.filter((item) => !item.success).length,
    results,
  };
}
