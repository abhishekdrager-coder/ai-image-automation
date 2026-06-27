import { Router } from 'express';
import { config } from '../config.js';
import { getIsoTimestamp } from '../utils/timeUtils.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    data: {
      status: 'ok',
      provider: config.app.provider,
      timestamp: getIsoTimestamp(),
      version: config.app.version,
    },
  });
});

export default router;
