import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildPrompt } from '../prompt.js';
import { UNTRUSTED_CONTENT_BEGIN } from '../../shared/untrustedContent.js';
import type { TechnicalChangeBriefInput } from '../types.js';

function baseInput(extra: Partial<TechnicalChangeBriefInput> = {}): TechnicalChangeBriefInput {
  return {
    rawDiff: 'diff --git a/x b/x',
    requirementText: 'Ship the feature.',
    changeExplanation: {} as TechnicalChangeBriefInput['changeExplanation'],
    requirementAlignment: {} as TechnicalChangeBriefInput['requirementAlignment'],
    ...extra,
  };
}

test('technical change brief prompt includes connected source context when provided', () => {
  const prompt = buildPrompt(
    baseInput({
      connectedSourceContext: 'Sources:\n- Notion — Spec page: Linked Notion page.',
    }),
  );
  assert.match(prompt, /CONNECTED SOURCE CONTEXT/);
  assert.match(prompt, /Notion — Spec page/);
  assert.match(prompt, /source of truth/i);
  assert.ok(prompt.includes(UNTRUSTED_CONTENT_BEGIN));
});

test('technical change brief prompt omits the connected block when there is none', () => {
  const prompt = buildPrompt(baseInput());
  assert.doesNotMatch(prompt, /CONNECTED SOURCE CONTEXT/);
});
