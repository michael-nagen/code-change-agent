import { test } from 'node:test';
import assert from 'node:assert/strict';

import { renderPromptPreferences } from '../promptPreferences.js';
import type { PromptPreferences } from '../types/memory.js';

const PREFS: PromptPreferences = {
  general: {
    preferredTone: 'concise',
    preferredOutputLength: 'short',
    includeConciseSummaries: true,
  },
  cursor: ['task-first', 'include changed files'],
  dailyUpdate: ['Notion-ready'],
  codeReview: ['be blunt'],
  weeklyReview: ['synthesize daily + technical'],
};

test('returns undefined when there are no preferences', () => {
  assert.equal(renderPromptPreferences({ preferences: undefined, categories: ['cursor'] }), undefined);
});

test('returns undefined when nothing relevant is present', () => {
  const result = renderPromptPreferences({
    preferences: { cursor: ['task-first'] },
    categories: ['demoVideo'],
  });
  assert.equal(result, undefined);
});

test('includes general preferences and only the requested categories', () => {
  const result = renderPromptPreferences({
    preferences: PREFS,
    categories: ['dailyUpdate', 'cursor'],
  });
  assert.ok(result);
  assert.match(result, /concise/);
  assert.match(result, /Notion-ready/);
  assert.match(result, /task-first/);
  // Categories not requested must not appear.
  assert.equal(result.includes('be blunt'), false);
  assert.equal(result.includes('synthesize daily'), false);
});

test('frames preferences as FORMAT/STYLE only and never overriding facts', () => {
  const result = renderPromptPreferences({ preferences: PREFS, categories: ['cursor'] });
  assert.ok(result);
  // The safety framing must lead the block so preferences can never be read as
  // permission to change factual claims grounded in the analysis/spec/diff.
  assert.match(result, /FORMAT/);
  assert.match(result, /never override facts/i);
});

test('never emits the string "undefined"', () => {
  const result = renderPromptPreferences({
    preferences: { general: {}, cursor: ['x'] },
    categories: ['cursor'],
  });
  assert.ok(result);
  assert.equal(result.includes('undefined'), false);
});

test('skips empty/whitespace-only bullets', () => {
  const result = renderPromptPreferences({
    preferences: { cursor: ['  ', 'real bullet', ''] },
    categories: ['cursor'],
  });
  assert.ok(result);
  assert.match(result, /real bullet/);
  // Only one bullet line should be present under the category.
  assert.equal((result.match(/\n- /g) ?? []).length, 1);
});
