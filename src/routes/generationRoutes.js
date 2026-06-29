import { Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validateRequest.js';
import { createImageBatch, createImageRun } from '../services/imageGenerationService.js';
import { getHistory, getRunById } from '../services/metadataService.js';
import { ValidationError } from '../errors.js';

const router = Router();

const structuredPromptFields = {
  subject: z.string().min(1).optional(),
  scene: z.string().min(1).optional(),
  composition: z.string().optional(),
  camera: z.string().optional(),
  lens: z.string().optional(),
  lighting: z.string().optional(),
  color: z.string().optional(),
  style: z.string().optional(),
  mood: z.string().optional(),
  quality: z.string().optional(),
  aspectRatio: z.string().optional(),
  negative: z.union([z.string(), z.array(z.string())]).optional(),
  extraDirectives: z.union([z.string(), z.array(z.string())]).optional(),
  preset: z.string().optional(),
};

const generationSchema = z.object({
  ...structuredPromptFields,
  prompt: z.string().min(1).optional(),
  size: z.string().optional(),
  seed: z.number().int().optional(),
  steps: z.number().int().positive().optional(),
  cfg: z.number().positive().optional(),
  model: z.string().optional(),
  dryRun: z.boolean().optional().default(false),
}).superRefine((value, context) => {
  const hasPrebuiltPrompt = Boolean(value.prompt);
  if (!hasPrebuiltPrompt && (!value.subject || !value.scene)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide either a prebuilt prompt or both subject and scene.',
      path: ['subject'],
    });
  }
});

const runIdParamSchema = z.object({
  runId: z.string().regex(/^run_[A-Za-z0-9_]+$/),
});

router.post('/create-image', validateRequest(generationSchema), async (req, res, next) => {
  try {
    const result = await createImageRun(req.validated.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/create-image/batch', validateRequest(z.object({ tasks: z.array(generationSchema).min(1) })), async (req, res, next) => {
  try {
    const summary = await createImageBatch(req.validated.body.tasks);
    res.json({ ok: true, data: summary });
  } catch (error) {
    next(error);
  }
});

router.get('/history', async (req, res, next) => {
  try {
    const limit = Number(req.query.limit || 20);
    if (!Number.isFinite(limit) || limit <= 0) {
      throw new ValidationError('Query parameter limit must be a positive number.');
    }

    const history = await getHistory(limit);
    res.json({ ok: true, data: history });
  } catch (error) {
    next(error);
  }
});

router.get('/history/:runId', validateRequest(runIdParamSchema, 'params'), async (req, res, next) => {
  try {
    const record = await getRunById(req.validated.params.runId);
    if (!record) {
      throw new ValidationError(`No run metadata found for ${req.validated.params.runId}.`, {
        code: 'RUN_NOT_FOUND',
        statusCode: 404,
      });
    }

    res.json({ ok: true, data: record });
  } catch (error) {
    next(error);
  }
});

export default router;
