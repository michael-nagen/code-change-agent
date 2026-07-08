import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildPrompt } from '../prompt.js';
import { UNTRUSTED_CONTENT_BEGIN } from '../../shared/untrustedContent.js';
import type { DailyWorkGuidanceInput } from '../types.js';

// The artifact contents are irrelevant to how the connected-source-context
// section renders (they are JSON-stringified wholesale), so a minimal input is
// enough to exercise the prompt wiring.
function baseInput(extra: Partial<DailyWorkGuidanceInput> = {}): DailyWorkGuidanceInput {
  return {
    specOrChecklist: 'Ship the feature.',
    date: '2026-07-07',
    changeExplanation: {} as DailyWorkGuidanceInput['changeExplanation'],
    requirementAlignment: {} as DailyWorkGuidanceInput['requirementAlignment'],
    gapReport: {} as DailyWorkGuidanceInput['gapReport'],
    flowArtifact: {} as DailyWorkGuidanceInput['flowArtifact'],
    ...extra,
  };
}

test('daily work guidance prompt includes connected source context when provided', () => {
  const prompt = buildPrompt(
    baseInput({
      connectedSourceContext: 'Sources:\n- GitHub — PR #7: Linked GitHub PR.',
    }),
  );
  assert.match(prompt, /CONNECTED SOURCE CONTEXT/);
  assert.match(prompt, /GitHub — PR #7/);
  assert.match(prompt, /supporting context only/i);
  assert.ok(prompt.includes(UNTRUSTED_CONTENT_BEGIN));
});

test('daily work guidance prompt omits the connected block when there is none', () => {
  const prompt = buildPrompt(baseInput());
  assert.doesNotMatch(prompt, /CONNECTED SOURCE CONTEXT/);
});
