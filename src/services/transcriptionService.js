import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { ValidationError } from '../errors.js';
import { config } from '../config.js';

function parseTimestampToSeconds(value) {
  const normalized = String(value || '').trim().replace(',', '.');
  const parts = normalized.split(':').map((item) => Number.parseFloat(item));

  if (parts.some((item) => Number.isNaN(item))) {
    return null;
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  if (parts.length === 1) {
    return parts[0];
  }

  return null;
}

function splitTextToSegments(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, index) => ({
      id: index + 1,
      text: item,
      startSec: null,
      endSec: null,
    }));
}

function parseSrt(content) {
  const blocks = String(content)
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const segments = [];
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) {
      continue;
    }

    const timeLineIndex = lines.findIndex((line) => line.includes('-->'));
    if (timeLineIndex < 0) {
      continue;
    }

    const [startRaw, endRaw] = lines[timeLineIndex].split('-->').map((value) => value.trim());
    const textLines = lines.slice(timeLineIndex + 1).join(' ').replace(/\s+/g, ' ').trim();

    const startSec = parseTimestampToSeconds(startRaw);
    const endSec = parseTimestampToSeconds(endRaw);

    if (!textLines) {
      continue;
    }

    segments.push({
      id: segments.length + 1,
      text: textLines,
      startSec,
      endSec,
    });
  }

  return segments;
}

function parseJsonTranscript(payload) {
  const fromSegments = Array.isArray(payload?.segments)
    ? payload.segments.map((item, index) => ({
      id: index + 1,
      text: String(item.text || '').trim(),
      startSec: Number.isFinite(item.startSec) ? item.startSec : null,
      endSec: Number.isFinite(item.endSec) ? item.endSec : null,
    })).filter((item) => item.text)
    : [];

  if (fromSegments.length > 0) {
    return fromSegments;
  }

  if (typeof payload?.text === 'string') {
    return splitTextToSegments(payload.text);
  }

  return [];
}

function estimateDurationsByWords(segments, durationSec, wordsPerMinute = config.video.wordsPerMinute) {
  const safeSegments = segments.map((segment) => ({
    ...segment,
    text: String(segment.text || '').trim(),
  })).filter((segment) => segment.text);

  if (safeSegments.length === 0) {
    return [];
  }

  const explicitDuration = Number.isFinite(durationSec) && durationSec > 0
    ? durationSec
    : null;

  const totalWords = safeSegments.reduce((sum, segment) => sum + segment.text.split(/\s+/).filter(Boolean).length, 0);
  const fallbackDuration = explicitDuration || Math.max(10, Math.round((totalWords / Math.max(80, wordsPerMinute)) * 60));

  let cursor = 0;
  return safeSegments.map((segment, index) => {
    const words = segment.text.split(/\s+/).filter(Boolean).length;
    const weight = words / Math.max(1, totalWords);
    const segmentDuration = index === safeSegments.length - 1
      ? Math.max(1, fallbackDuration - cursor)
      : Math.max(1, Math.round(fallbackDuration * weight));

    const withTiming = {
      ...segment,
      startSec: Number.isFinite(segment.startSec) ? segment.startSec : cursor,
      endSec: Number.isFinite(segment.endSec) ? segment.endSec : cursor + segmentDuration,
    };

    cursor = withTiming.endSec;
    return withTiming;
  });
}

export async function transcribeWithTurboScribe(audioPath, options = {}) {
  if (!config.turboScribe.apiUrl || !config.turboScribe.apiKey) {
    throw new ValidationError('TurboScribe API is not configured. Set TURBOSCRIBE_API_URL and TURBOSCRIBE_API_KEY or provide transcriptPath.');
  }

  const absolutePath = path.resolve(audioPath);
  const audioBuffer = await readFile(absolutePath);
  const form = new FormData();
  form.append('file', new Blob([audioBuffer]), path.basename(absolutePath));
  form.append('language', String(options.language || 'en'));

  const response = await fetch(config.turboScribe.apiUrl, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.turboScribe.apiKey}`,
    },
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ValidationError(`TurboScribe request failed (${response.status}): ${text.slice(0, 300)}`);
  }

  const payload = await response.json();
  const segments = parseJsonTranscript(payload);
  if (segments.length === 0) {
    throw new ValidationError('TurboScribe response did not include transcript segments or text.');
  }

  return {
    source: 'turboscribe-api',
    text: payload.text || segments.map((item) => item.text).join(' '),
    segments,
  };
}

export async function loadTranscriptFromFile(transcriptPath) {
  const absolutePath = path.resolve(transcriptPath);
  const raw = await readFile(absolutePath, 'utf8');
  const extension = path.extname(absolutePath).toLowerCase();

  if (extension === '.srt' || extension === '.vtt') {
    const segments = parseSrt(raw);
    return {
      source: extension.slice(1),
      text: segments.map((segment) => segment.text).join(' '),
      segments,
    };
  }

  if (extension === '.json') {
    const payload = JSON.parse(raw);
    const segments = parseJsonTranscript(payload);
    return {
      source: 'json',
      text: payload.text || segments.map((segment) => segment.text).join(' '),
      segments,
    };
  }

  return {
    source: 'text',
    text: raw,
    segments: splitTextToSegments(raw),
  };
}

export async function resolveTranscript({ transcriptPath, audioPath, fallbackScriptText, language, durationSec }) {
  if (transcriptPath) {
    const transcript = await loadTranscriptFromFile(transcriptPath);
    return {
      ...transcript,
      segments: estimateDurationsByWords(transcript.segments, durationSec),
    };
  }

  if (audioPath && config.turboScribe.apiUrl && config.turboScribe.apiKey) {
    const transcript = await transcribeWithTurboScribe(audioPath, { language });
    return {
      ...transcript,
      segments: estimateDurationsByWords(transcript.segments, durationSec),
    };
  }

  if (fallbackScriptText) {
    const segments = estimateDurationsByWords(splitTextToSegments(fallbackScriptText), durationSec);
    return {
      source: 'script-fallback',
      text: fallbackScriptText,
      segments,
    };
  }

  throw new ValidationError('No transcript source available. Provide transcriptPath, configure TurboScribe API with audioPath, or provide script text.');
}
