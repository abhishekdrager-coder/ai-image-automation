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
  const callToAction = toSentence(input.callToAction || 'Follow for the next part.');

  const scriptParagraphs = [
    `This video is for ${audience}, and the topic is ${topic}. In ${durationSec} seconds, I want to keep the message clear, useful, and easy to use on every social media platform.`,
    `The first thing to know is the main idea. Say it simply, say it once, and keep the words natural so it sounds like a real person speaking.`,
    `Then move into the practical part. Show the one or two steps that matter most, and keep each sentence short enough to be easy to follow while listening.`,
    `End with the takeaway. Make the listener remember the one thing they should do next, and keep the closing sentence direct and confident.`,
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
