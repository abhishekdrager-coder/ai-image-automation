import dotenv from 'dotenv';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { ConfigError } from './errors.js';

dotenv.config({ quiet: true });

const packageJson = JSON.parse(readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));

const env = process.env;

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value, fallback = true) => {
  if (value === undefined) {
    return fallback;
  }

  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
};

const resolvePath = (value) => path.resolve(process.cwd(), value);

export const config = {
  nodeEnv: env.NODE_ENV || 'development',
  port: toNumber(env.PORT, 3000),
  app: {
    provider: env.APP_PROVIDER || 'freegen',
    version: packageJson.version,
  },
  freegen: {
    apiUrl: env.FREEGEN_API_URL || '',
    apiKey: env.FREEGEN_API_KEY || '',
    timeoutMs: toNumber(env.FREEGEN_TIMEOUT_MS, 60000),
    defaultSize: env.FREEGEN_DEFAULT_SIZE || '1024x1024',
    defaultSteps: toNumber(env.FREEGEN_DEFAULT_STEPS, 30),
    defaultCfg: toNumber(env.FREEGEN_DEFAULT_CFG, 7),
  },
  output: {
    imageDir: resolvePath(env.OUTPUT_IMAGE_DIR || 'outputs/images'),
    metadataDir: resolvePath(env.OUTPUT_METADATA_DIR || 'outputs/metadata'),
    artifactDir: resolvePath('outputs/artifacts'),
  },
  prompt: {
    enablePromptLogging: toBoolean(env.ENABLE_PROMPT_LOGGING, true),
  },
  retry: {
    maxRetries: toNumber(env.MAX_RETRIES, 3),
    baseDelayMs: toNumber(env.RETRY_BASE_DELAY_MS, 800),
  },
};

export function assertFreegenConfigured() {
  if (!config.freegen.apiUrl) {
    throw new ConfigError(
      'FREEGEN_API_URL is required for live image generation. Set it in your environment or use dryRun mode.',
    );
  }
}
