import path from 'node:path';
import { access } from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { config } from '../config.js';
import { ValidationError } from '../errors.js';
import { ensureDir } from '../utils/fileUtils.js';

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(`${command} exited with code ${code}: ${stderr || stdout}`));
    });
  });
}

export async function assertFfmpegAvailable() {
  try {
    await runCommand('ffmpeg', ['-version']);
    await runCommand('ffprobe', ['-version']);
  } catch {
    throw new ValidationError('ffmpeg/ffprobe is required for video assembly. Install ffmpeg locally and retry.');
  }
}

export async function getMediaDurationSec(filePath) {
  const absolutePath = path.resolve(filePath);
  await access(absolutePath);

  const { stdout } = await runCommand('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    absolutePath,
  ]);

  const duration = Number.parseFloat(String(stdout).trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    return null;
  }

  return duration;
}

function secondsToConcatDuration(value) {
  return Math.max(0.2, Number(value || 0)).toFixed(3);
}

function createScaleFilter() {
  return `scale=${config.video.width}:${config.video.height}:force_original_aspect_ratio=decrease,pad=${config.video.width}:${config.video.height}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`;
}

export async function buildVideoFromTimeline({ timelineItems, outputVideoPath, audioPath, workingDir }) {
  if (!Array.isArray(timelineItems) || timelineItems.length === 0) {
    throw new ValidationError('timelineItems must be a non-empty array.');
  }

  await assertFfmpegAvailable();
  await ensureDir(path.dirname(outputVideoPath));
  await ensureDir(workingDir);

  const listPath = path.join(workingDir, 'images.concat.txt');
  const concatContent = [
    ...timelineItems.map((item) => [
      `file '${path.resolve(item.imagePath).replace(/'/g, "'\\''")}'`,
      `duration ${secondsToConcatDuration(item.durationSec)}`,
    ].join('\n')),
    `file '${path.resolve(timelineItems[timelineItems.length - 1].imagePath).replace(/'/g, "'\\''")}'`,
  ].join('\n');

  await ensureDir(path.dirname(listPath));
  await writeFile(listPath, `${concatContent}\n`, 'utf8');

  const args = [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', listPath,
  ];

  if (audioPath) {
    args.push('-i', path.resolve(audioPath));
  }

  args.push(
    '-vf', createScaleFilter(),
    '-r', String(config.video.fps),
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
  );

  if (audioPath) {
    args.push('-c:a', 'aac', '-shortest');
  }

  args.push(path.resolve(outputVideoPath));

  await runCommand('ffmpeg', args);

  return path.resolve(outputVideoPath);
}
