import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { ValidationError } from '../errors.js';
import { config } from '../config.js';
import { ensureDir } from '../utils/fileUtils.js';
import { generateVideoScript } from '../services/videoScriptService.js';
import { runVideoPipeline } from '../services/videoPipelineService.js';

const router = Router();
const uploadsDir = path.resolve('outputs/uploads');

await ensureDir(uploadsDir);

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadsDir);
  },
  filename: (_req, file, callback) => {
    const safeName = String(file.originalname || 'audio')
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9._-]/g, '');
    callback(null, `${Date.now()}_${safeName}`);
  },
});

const upload = multer({ storage });

function toOutputsUrl(absolutePath) {
  if (!absolutePath) {
    return null;
  }

  const outputsRoot = path.resolve('outputs');
  const relativePath = path.relative(outputsRoot, absolutePath).replace(/\\/g, '/');
  if (relativePath.startsWith('..')) {
    return null;
  }

  return `/outputs/${relativePath}`;
}

router.get('/studio', (_req, res) => {
  res.sendFile(path.resolve('public/studio.html'));
});

router.post('/api/studio/script', async (req, res, next) => {
  try {
    const topic = String(req.body?.topic || '').trim();
    if (!topic) {
      throw new ValidationError('topic is required.');
    }

    const audience = String(req.body?.audience || '').trim();
    if (!audience) {
      throw new ValidationError('audience is required.');
    }

    const scriptProvider = String(req.body?.scriptProvider || 'auto').trim() || 'auto';
    const scriptModel = String(req.body?.scriptModel || '').trim();

    const durationSec = Number(req.body?.durationSec || 60);
    const script = await generateVideoScript({
      topic,
      audience,
      durationSec: Number.isFinite(durationSec) ? durationSec : 60,
      provider: scriptProvider,
      model: scriptModel,
      callToAction: req.body?.callToAction,
    });

    res.json({
      ok: true,
      data: {
        scriptText: script.scriptText,
        provider: script.provider,
        model: script.model,
        fallbackUsed: script.fallbackUsed,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/api/studio/generate', upload.single('audio'), async (req, res, next) => {
  try {
    const topic = String(req.body?.topic || '').trim();
    if (!topic) {
      throw new ValidationError('topic is required.');
    }

    const audience = String(req.body?.audience || '').trim();
    if (!audience) {
      throw new ValidationError('audience is required.');
    }

    const durationSec = Number(req.body?.durationSec || 60);
    const scriptProvider = String(req.body?.scriptProvider || 'auto').trim() || 'auto';
    const scriptModel = String(req.body?.scriptModel || '').trim();
    const freegenConfigured = Boolean(config.freegen.apiUrl)
      && !String(config.freegen.apiUrl).includes('api.example.com');

    const result = await runVideoPipeline({
      topic,
      audience,
      durationSec: Number.isFinite(durationSec) ? durationSec : 60,
      scriptProvider,
      scriptModel,
      preset: req.body?.preset || 'cinematic',
      scriptText: req.body?.scriptText || undefined,
      audioPath: req.file?.path || undefined,
      transcriptPath: req.body?.transcriptPath || undefined,
      dryRunImages: !freegenConfigured,
      publish: false,
    });

    res.json({
      ok: true,
      data: {
        runId: result.runId,
        videoPath: result.videoPath,
        videoUrl: toOutputsUrl(result.videoPath),
        summaryPath: result.summaryPath,
        summaryUrl: toOutputsUrl(result.summaryPath),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
