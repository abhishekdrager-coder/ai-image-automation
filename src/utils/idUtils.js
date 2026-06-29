import crypto from 'node:crypto';
import { getCompactTimestamp } from './timeUtils.js';

export function createShortId(length = 6) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

export function createRunId() {
  return `run_${getCompactTimestamp()}_${createShortId(8)}`;
}
