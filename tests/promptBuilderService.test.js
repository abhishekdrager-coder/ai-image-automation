import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt } from '../src/services/promptBuilderService.js';

test('buildPrompt applies preset defaults in deterministic order', () => {
  const result = buildPrompt({
    subject: 'robot barista',
    scene: 'busy morning cafe',
    preset: 'cinematic',
    mood: 'hopeful',
    extraDirectives: ['steam detail'],
  });

  assert.equal(result.promptBreakdown.preset, 'cinematic');
  assert.match(result.finalPrompt, /^Subject: robot barista \| Scene: busy morning cafe \|/);
  assert.match(result.finalPrompt, /Style: cinematic storytelling, immersive detail, dramatic atmosphere/);
  assert.deepEqual(result.promptBreakdown.negativePrompt, ['blurry', 'low detail', 'distorted anatomy', 'text watermark']);
});

test('buildPrompt rejects missing required fields', () => {
  assert.throws(() => buildPrompt({ scene: 'empty studio' }), /subject and scene are required/i);
});
