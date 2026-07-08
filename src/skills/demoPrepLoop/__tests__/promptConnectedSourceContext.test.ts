import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildPrompt } from '../prompt.js';
import { UNTRUSTED_CONTENT_BEGIN } from '../../shared/untrustedContent.js';
import type { DemoPrepLoopInput } from '../types.js';

function baseInput(extra: Partial<DemoPrepLoopInput> = {}): DemoPrepLoopInput {
  return {
    rawDiff: 'diff --git a/x b/x',
    requirementText: 'Ship the feature.',
    changeExplanation: {} as DemoPrepLoopInput['changeExplanation'],
    requirementAlignment: {} as DemoPrepLoopInput['requirementAlignment'],
    ...extra,
  };
}

test('demo prep loop prompt includes connected source context when provided', () => {
  const prompt = buildPrompt(
    baseInput({
      connectedSourceContext: 'Sources:\n- GitHub — PR #42: Linked GitHub PR.',
    }),
  );
  assert.match(prompt, /CONNECTED SOURCE CONTEXT/);
  assert.match(prompt, /GitHub — PR #42/);
  assert.match(prompt, /supporting context only/i);
  assert.ok(prompt.includes(UNTRUSTED_CONTENT_BEGIN));
});

test('demo prep loop prompt omits the connected block when there is none', () => {
  const prompt = buildPrompt(baseInput());
  assert.doesNotMatch(prompt, /CONNECTED SOURCE CONTEXT/);
});
