import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const workspaceRoot = path.resolve(process.cwd());

export function resolveSafeWorkspacePath(filePath) {
  const resolvedPath = path.normalize(path.resolve(filePath));
  const normalizedWorkspaceRoot = path.normalize(workspaceRoot);
  const workspacePrefix = normalizedWorkspaceRoot.endsWith(path.sep)
    ? normalizedWorkspaceRoot
    : `${normalizedWorkspaceRoot}${path.sep}`;

  if (resolvedPath !== normalizedWorkspaceRoot && !resolvedPath.startsWith(workspacePrefix)) {
    throw new Error(`Refusing to access a path outside the workspace: ${resolvedPath}`);
  }

  return resolvedPath;
}

export async function ensureDir(dirPath) {
  await mkdir(resolveSafeWorkspacePath(dirPath), { recursive: true });
}

export async function ensureParentDir(filePath) {
  await ensureDir(path.dirname(resolveSafeWorkspacePath(filePath)));
}

export async function writeJsonFile(filePath, data) {
  const safePath = resolveSafeWorkspacePath(filePath);
  await ensureParentDir(safePath);
  await writeFile(safePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export async function readJsonFile(filePath, fallback) {
  const safePath = resolveSafeWorkspacePath(filePath);

  try {
    const content = await readFile(safePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return fallback;
    }

    throw error;
  }
}

export async function writeBufferToFile(filePath, buffer) {
  const safePath = resolveSafeWorkspacePath(filePath);
  await ensureParentDir(safePath);
  await writeFile(safePath, buffer);
}

export function slugify(value) {
  return (
    String(value || 'image')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'image'
  );
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
