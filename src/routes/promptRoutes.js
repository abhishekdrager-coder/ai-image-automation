import { Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validateRequest.js';
import { buildPrompt } from '../services/promptBuilderService.js';

const router = Router();

const buildPromptSchema = z.object({
  subject: z.string().min(1),
  scene: z.string().min(1),
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
});

router.post('/build-prompt', validateRequest(buildPromptSchema), (req, res) => {
  const result = buildPrompt(req.validated.body);
  res.json({
    ok: true,
    data: result,
  });
});

export default router;
