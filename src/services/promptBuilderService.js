import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { ValidationError } from '../errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const presetFile = path.resolve(__dirname, '../presets/styles.json');
const stylePresets = JSON.parse(readFileSync(presetFile, 'utf8'));

const defaultNegativePrompts = ['blurry', 'low quality', 'artifacts', 'deformed features'];

const normalizeText = (value) => {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value)
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/,+/g, ',')
    .replace(/,\s*,/g, ', ')
    .trim()
    .replace(/^,|,$/g, '');
};

const normalizeList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean);
  }

  if (!value) {
    return [];
  }

  return normalizeText(value)
    .split(',')
    .map((item) => normalizeText(item))
    .filter(Boolean);
};

const joinParts = (...parts) => normalizeText(parts.filter(Boolean).join(', '));

export function getAvailablePresets() {
  return Object.keys(stylePresets);
}

export function buildPrompt(input = {}) {
  const presetName = normalizeText(input.preset);
  const preset = presetName ? stylePresets[presetName] : undefined;
  const normalizedNegative = normalizeList(input.negative);

  if (presetName && !preset) {
    throw new ValidationError(`Unknown preset "${presetName}". Choose one of: ${getAvailablePresets().join(', ')}.`);
  }

  const normalizedInput = {
    subject: normalizeText(input.subject),
    scene: normalizeText(input.scene),
    composition: normalizeText(input.composition),
    camera: normalizeText(input.camera || preset?.cameraHints),
    lens: normalizeText(input.lens),
    lighting: normalizeText(input.lighting || preset?.lightingHints),
    color: normalizeText(input.color),
    style: normalizeText(input.style || preset?.styleText),
    mood: normalizeText(input.mood),
    quality: normalizeText(input.quality || preset?.qualityHints),
    aspectRatio: normalizeText(input.aspectRatio),
    negative: normalizedNegative.length ? normalizedNegative : (preset?.recommendedNegativePrompts || defaultNegativePrompts),
    extraDirectives: normalizeList(input.extraDirectives),
    preset: presetName || null,
  };

  if (!normalizedInput.subject || !normalizedInput.scene) {
    throw new ValidationError('Both subject and scene are required to build a prompt.');
  }

  const extraDirectives = [...normalizedInput.extraDirectives];
  if (normalizedInput.aspectRatio) {
    extraDirectives.unshift(`aspect ratio ${normalizedInput.aspectRatio}`);
  }

  const promptBreakdown = {
    subject: normalizedInput.subject,
    scene: normalizedInput.scene,
    composition: normalizedInput.composition,
    cameraLens: joinParts(normalizedInput.camera, normalizedInput.lens),
    lighting: normalizedInput.lighting,
    colorMood: joinParts(normalizedInput.color, normalizedInput.mood),
    style: normalizedInput.style,
    quality: normalizedInput.quality,
    extraDirectives,
    negativePrompt: normalizedInput.negative,
    preset: normalizedInput.preset,
  };

  const orderedSections = [
    ['Subject', promptBreakdown.subject],
    ['Scene', promptBreakdown.scene],
    ['Composition', promptBreakdown.composition],
    ['Camera/Lens', promptBreakdown.cameraLens],
    ['Lighting', promptBreakdown.lighting],
    ['Color/Mood', promptBreakdown.colorMood],
    ['Style', promptBreakdown.style],
    ['Quality', promptBreakdown.quality],
    ['Extra Directives', promptBreakdown.extraDirectives.join(', ')],
    ['Negative Prompt', promptBreakdown.negativePrompt.join(', ')],
  ].filter(([, value]) => value);

  const finalPrompt = orderedSections
    .map(([label, value]) => `${label}: ${normalizeText(value)}`)
    .join(' | ')
    .replace(/\|\s*\|/g, '|')
    .trim();

  return {
    finalPrompt,
    promptBreakdown,
    normalizedInput,
  };
}
