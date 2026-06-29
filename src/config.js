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

  const normalized = String(value).toLowerCase();
  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return ['true', '1', 'yes', 'on'].includes(normalized);
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
    videoDir: resolvePath(env.OUTPUT_VIDEO_DIR || 'outputs/videos'),
    videoRunDir: resolvePath(env.OUTPUT_VIDEO_RUN_DIR || 'outputs/video-runs'),
  },
  prompt: {
    enablePromptLogging: toBoolean(env.ENABLE_PROMPT_LOGGING, true),
  },
  retry: {
    maxRetries: toNumber(env.MAX_RETRIES, 3),
    baseDelayMs: toNumber(env.RETRY_BASE_DELAY_MS, 800),
  },
  script: {
    provider: env.SCRIPT_PROVIDER || 'auto',
    model: env.SCRIPT_MODEL || '',
    anthropicModel: env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
    openaiModel: env.OPENAI_MODEL || 'gpt-4.1',
    openrouterModel: env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001',
    maxTokens: toNumber(env.SCRIPT_MAX_TOKENS, 900),
    temperature: Number.isFinite(Number(env.SCRIPT_TEMPERATURE))
      ? Number(env.SCRIPT_TEMPERATURE)
      : 0.7,
    anthropicApiKey: env.ANTHROPIC_API_KEY || '',
    openaiApiKey: env.OPENAI_API_KEY || '',
    openrouterApiKey: env.OPENROUTER_API_KEY || '',
    openrouterApiUrl: env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1/chat/completions',
  },
  video: {
    width: toNumber(env.VIDEO_WIDTH, 1080),
    height: toNumber(env.VIDEO_HEIGHT, 1920),
    fps: toNumber(env.VIDEO_FPS, 30),
    wordsPerMinute: toNumber(env.VIDEO_WORDS_PER_MINUTE, 135),
  },
  turboScribe: {
    apiUrl: env.TURBOSCRIBE_API_URL || '',
    apiKey: env.TURBOSCRIBE_API_KEY || '',
  },
  publish: {
    enabledByDefault: toBoolean(env.AUTO_PUBLISH, false),
    youtubeAccessToken: env.YOUTUBE_ACCESS_TOKEN || '',
    youtubeChannelId: env.YOUTUBE_CHANNEL_ID || '',
    facebookPageId: env.FACEBOOK_PAGE_ID || '',
    facebookAccessToken: env.FACEBOOK_ACCESS_TOKEN || '',
    instagramUserId: env.INSTAGRAM_USER_ID || '',
    instagramAccessToken: env.INSTAGRAM_ACCESS_TOKEN || '',
    instagramVideoUrl: env.INSTAGRAM_VIDEO_PUBLIC_URL || '',
    webhookUrls: (env.SOCIAL_WEBHOOK_URLS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  },
};

export function assertFreegenConfigured() {
  if (!config.freegen.apiUrl) {
    throw new ConfigError(
      'FREEGEN_API_URL is required for live image generation. Set it in your environment or use dryRun mode.',
    );
  }
}
