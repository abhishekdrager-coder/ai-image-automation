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

function normalizeTopic(topic) {
  return topic.replace(/[.?!]+$/g, '').trim();
}

function buildReflectionQuestions(topic) {
  const cleanTopic = normalizeTopic(topic);
  return [
    `What did I understand about ${cleanTopic} in that moment?`,
    'What signal did I ignore because I was rushed or emotional?',
    'What one decision will I make differently next time?',
  ];
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
  const callToAction = toSentence(input.callToAction || 'Apply this in your next decision today.');
  const cleanTopic = normalizeTopic(topic);
  const questions = buildReflectionQuestions(topic);
  const audienceIntro = audience.toLowerCase().includes('self improvement')
    ? 'self-improvement'
    : audience;

  const scriptParagraphs = [
    `If you are focused on ${audienceIntro}, you have probably had a moment where ${cleanTopic} suddenly made perfect sense only after everything was over.`,
    `That is the core lesson. In real time, pressure and emotion make things blurry. Later, the pattern looks obvious, and you feel like you should have known.`,
    `The trap is turning that clarity into self-attack. You call yourself careless, when in reality you were making the best decision you could with limited information.`,
    `Use that moment as data, not punishment. Ask yourself: ${questions[0]} ${questions[1]} ${questions[2]}`,
    `Growth is not about always getting it right in the first attempt. Growth is learning faster after each replay. Keep the lesson complete in this one video and act on it now. ${callToAction}`,
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
