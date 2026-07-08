import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  validatePromptPreferences,
  validateUserPreferencesMemory,
  validateProjectMemory,
} from '../validateMemory.js';
import { MemoryStoreError } from '../../errors/MemoryStoreError.js';

test('validatePromptPreferences accepts an empty object', () => {
  assert.deepEqual(validatePromptPreferences({}), {});
});

test('validatePromptPreferences keeps only present, well-formed fields', () => {
  const result = validatePromptPreferences({
    general: {
      preferredTone: 'concise',
      includeConciseSummaries: true,
    },
    cursor: ['task-first', 'include changed files'],
    codeReview: ['be blunt'],
  });
  assert.deepEqual(result, {
    general: { preferredTone: 'concise', includeConciseSummaries: true },
    cursor: ['task-first', 'include changed files'],
    codeReview: ['be blunt'],
  });
});

test('validatePromptPreferences rejects a non-string bullet', () => {
  assert.throws(
    () => validatePromptPreferences({ cursor: ['ok', 42] }),
    (err: unknown) => err instanceof MemoryStoreError && err.code === 'VALIDATION',
  );
});

test('validatePromptPreferences rejects a non-boolean general flag', () => {
  assert.throws(
    () => validatePromptPreferences({ general: { includeConciseSummaries: 'yes' } }),
    (err: unknown) => err instanceof MemoryStoreError && err.code === 'VALIDATION',
  );
});

test('user memory round-trips promptPreferences and omits it when absent', () => {
  const withPrefs = validateUserPreferencesMemory({
    schemaVersion: 1,
    userId: 'local',
    preferences: [],
    updatedAt: '2026-07-07T00:00:00.000Z',
    promptPreferences: { dailyUpdate: ['Notion-ready'] },
  });
  assert.deepEqual(withPrefs.promptPreferences, { dailyUpdate: ['Notion-ready'] });

  const withoutPrefs = validateUserPreferencesMemory({
    schemaVersion: 1,
    userId: 'local',
    preferences: [],
    updatedAt: '2026-07-07T00:00:00.000Z',
  });
  assert.equal('promptPreferences' in withoutPrefs, false);
});

test('user memory rejects invalid promptPreferences', () => {
  assert.throws(
    () =>
      validateUserPreferencesMemory({
        schemaVersion: 1,
        userId: 'local',
        preferences: [],
        updatedAt: '2026-07-07T00:00:00.000Z',
        promptPreferences: { cursor: [1, 2, 3] },
      }),
    (err: unknown) => err instanceof MemoryStoreError && err.code === 'VALIDATION',
  );
});

test('project memory keeps activeSpecSummary when present and omits it otherwise', () => {
  const base = {
    schemaVersion: 1,
    userId: 'local',
    projectId: 'demo',
    history: [],
    updatedAt: '2026-07-07T00:00:00.000Z',
  };
  const withSummary = validateProjectMemory({ ...base, activeSpecSummary: 'Ship the cache.' });
  assert.equal(withSummary.activeSpecSummary, 'Ship the cache.');

  const withoutSummary = validateProjectMemory(base);
  assert.equal('activeSpecSummary' in withoutSummary, false);
});

test('project memory rejects an empty activeSpecSummary string', () => {
  assert.throws(
    () =>
      validateProjectMemory({
        schemaVersion: 1,
        userId: 'local',
        projectId: 'demo',
        history: [],
        updatedAt: '2026-07-07T00:00:00.000Z',
        activeSpecSummary: '   ',
      }),
    (err: unknown) => err instanceof MemoryStoreError && err.code === 'VALIDATION',
  );
});
