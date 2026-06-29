import express from 'express';
import path from 'node:path';
import healthRoutes from './routes/healthRoutes.js';
import promptRoutes from './routes/promptRoutes.js';
import generationRoutes from './routes/generationRoutes.js';
import studioRoutes from './routes/studioRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { ensureMetadataStorage } from './services/metadataService.js';
import { ensureDir } from './utils/fileUtils.js';

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use('/outputs', express.static(path.resolve('outputs')));
app.use(express.static(path.resolve('public')));
app.use(healthRoutes);
app.use(promptRoutes);
app.use(generationRoutes);
app.use(studioRoutes);
app.use(errorHandler);

async function bootstrap() {
  await ensureDir(config.output.imageDir);
  await ensureDir(config.output.videoDir);
  await ensureDir(config.output.videoRunDir);
  await ensureMetadataStorage();
  app.listen(config.port, () => {
    logger.info(`AI image automation API listening on port ${config.port}`, {
      provider: config.app.provider,
      nodeEnv: config.nodeEnv,
    });
  });
}

bootstrap().catch((error) => {
  logger.error('Unable to start application', { message: error.message });
  process.exitCode = 1;
});
