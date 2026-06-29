export function getIsoTimestamp() {
  return new Date().toISOString();
}

export function getCompactTimestamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function getDurationMs(startTimeMs) {
  return Date.now() - startTimeMs;
}
