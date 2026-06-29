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

  const audience = toSentence(input.audience || 'busy creators');
  const tone = toSentence(input.tone || 'clear, energetic, practical');
  const callToAction = toSentence(input.callToAction || 'Follow for the next part.');

  const storyBeats = [
    `Hook: Imagine turning one idea about ${topic} into a polished short video in under an hour.`,
    `Problem: Most creators lose time jumping between script writing, recording, transcription, image creation, and editing tools.`,
    `Promise: This workflow keeps every step connected so your narration, visuals, and export stay aligned.`,
    `Step 1: Start with a short script that explains ${topic} in plain language and one clear transformation.`,
    `Step 2: Record your voice naturally, then transcribe and split your narration into visual beats.`,
    `Step 3: Generate focused image prompts for each beat so every frame reinforces what you are saying.`,
    `Step 4: Assemble timestamped images and voice-over into one vertical video ready for upload.`,
    `Closing: The goal is not more content, it is consistent content that compounds every week.`,
    `Call to action: ${callToAction}`,
  ];

  const chunkSize = 2;
  const sections = splitInChunks(storyBeats, chunkSize).map((lines, idx) => ({
    index: idx + 1,
    heading: `Section ${idx + 1}`,
    text: lines.join(' '),
  }));

  const scriptText = [
    `Title: ${topic}`,
    `Audience: ${audience}`,
    `Tone: ${tone}`,
    `Target Duration: ${durationSec} seconds`,
    '',
    ...sections.flatMap((section) => [
      `${section.heading}:`,
      section.text,
      '',
    ]),
  ].join('\n').trim();

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
