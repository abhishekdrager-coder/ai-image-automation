import { ValidationError } from '../errors.js';

function toSentence(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitInChunks(list, size) {
  const chunks = [];
  for (let index = 0; index < list.length; index += size) {
    chunks.push(list.slice(index, index + size));
  }
  return chunks;
}

function estimateWordTarget(durationSec) {
  return Math.max(120, Math.round((durationSec / 60) * 145));
}

export function generateNarrationScript(input = {}) {
  const topic = toSentence(input.topic);
  if (!topic) {
    throw new ValidationError('topic is required to generate a script.');
  }

  const durationSec = Number.isFinite(input.durationSec)
    ? Math.max(30, Math.round(input.durationSec))
    : 60;

  const audience = toSentence(input.audience || 'viewers');
  const tone = toSentence(input.tone || 'clear, energetic, practical');
  const callToAction = toSentence(input.callToAction || 'Follow for the next part.');

  const scriptParagraphs = [
    `If you're ${audience}, here's a simple way to turn ${topic} into a clean video without wasting time across too many tools.`,
    `Start by writing one focused script, record your voice in a natural pace, and keep the message tight so every sentence moves the story forward.`,
    `Then transcribe the audio, split it into short visual beats, and generate images that match each beat so the visuals stay locked to the narration.`,
    `From there, assemble the images in order, keep the timing steady, and build a finished video that feels consistent from the first frame to the last.`,
    `${callToAction}`,
  ];

  const scriptText = scriptParagraphs.join('\n\n');
  const sections = scriptParagraphs.map((text, index) => ({
    index: index + 1,
    heading: null,
    text,
  }));

  const wordTarget = estimateWordTarget(durationSec);

  return {
    topic,
    audience,
    tone,
    durationSec,
    wordTarget,
    sections,
    scriptText,
  };
}

export function scriptToSegments(scriptText) {
  const clean = toSentence(scriptText);
  if (!clean) {
    return [];
  }

  return clean
    .split(/(?<=[.!?])\s+/)
    .map((line) => toSentence(line))
    .filter(Boolean)
    .map((line, index) => ({
      id: index + 1,
      text: line,
    }));
}
