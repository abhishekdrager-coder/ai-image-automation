import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

export async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

export async function ensureParentDir(filePath) {
  await ensureDir(path.dirname(filePath));
}

export async function writeJsonFile(filePath, data) {
  await ensureParentDir(filePath);
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}
`, 'utf8');
}

export async function readJsonFile(filePath, fallback) {
  try {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return fallback;
    }

    throw error;
  }
}

export async function writeBufferToFile(filePath, buffer) {
  await ensureParentDir(filePath);
  await writeFile(filePath, buffer);
}

export function slugify(value) {
  return String(value || 'image')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'image';
}

export async function downloadFile(url, timeoutMs) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Unable to download image from ${url}. Received ${response.status}.`);
  }

  return Buffer.from(await response.arrayBuffer());
}
