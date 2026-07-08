import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildPrompt } from '../prompt.js';
import { UNTRUSTED_CONTENT_BEGIN } from '../../shared/untrustedContent.js';
import type { WeeklyReviewInput } from '../types.js';

function baseInput(extra: Partial<WeeklyReviewInput> = {}): WeeklyReviewInput {
  return {
    rawDiff: 'diff --git a/x b/x',
    requirementText: 'Ship the feature.',
    generatedAt: '2026-07-07T00:00:00.000Z',
    changeExplanation: {} as WeeklyReviewInput['changeExplanation'],
    requirementAlignment: {} as WeeklyReviewInput['requirementAlignment'],
    ...extra,
  };
}

test('weekly review prompt includes connected source context when provided', () => {
  const prompt = buildPrompt(
    baseInput({
      connectedSourceContext: 'Sources:\n- Memory — Saved project memory: prior progress.',
    }),
  );
  assert.match(prompt, /CONNECTED SOURCE CONTEXT/);
  assert.match(prompt, /Memory — Saved project memory/);
  assert.match(prompt, /source of truth/i);
  assert.ok(prompt.includes(UNTRUSTED_CONTENT_BEGIN));
});

test('weekly review prompt omits the connected block when there is none', () => {
  const prompt = buildPrompt(baseInput());
  assert.doesNotMatch(prompt, /CONNECTED SOURCE CONTEXT/);
});
