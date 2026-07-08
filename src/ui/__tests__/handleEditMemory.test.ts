import { test } from 'node:test';
import assert from 'node:assert/strict';

import { handleEditMemory } from '../handleEditMemory.js';
import { handleAnalyze } from '../handleAnalyze.js';
import { MockAnalysisRunner } from '../analysisRunner.js';
import { InMemoryMemoryStore } from '../../memory/index.js';

const USER_ID = 'local';
const PROJECT_NAME = 'Checkout Service';
const PROJECT_ID = 'checkout-service';

test('malformed body is rejected without throwing', async () => {
  const response = await handleEditMemory({ memoryStore: new InMemoryMemoryStore(), body: null });
  assert.equal(response.status, 'error');
});

test('an empty edit (no project, no preferences) is rejected', async () => {
  const response = await handleEditMemory({ memoryStore: new InMemoryMemoryStore(), body: {} });
  assert.equal(response.status, 'error');
  if (response.status !== 'error') return;
  assert.match(response.message, /nothing to save/i);
});

test('atomic: an invalid project section leaves preferences unwritten', async () => {
  const memoryStore = new InMemoryMemoryStore();

  const response = await handleEditMemory({
    memoryStore,
    body: {
      projectName: PROJECT_NAME,
      preferences: { cursor: ['task-first'] },
      project: {
        dailySummary: 'Did work today.',
        checklist: [{ item: 'Cache', status: 'definitely-not-valid' }],
      },
    },
  });

  assert.equal(response.status, 'error');
  if (response.status !== 'error') return;
  assert.match(response.message, /invalid checklist status/i);

  // The (valid) preferences must NOT have been persisted before the project
  // section failed validation.
  assert.equal(await memoryStore.getUserMemory({ userId: USER_ID }), undefined);
  assert.equal(
    await memoryStore.getProjectMemory({ userId: USER_ID, projectId: PROJECT_ID }),
    undefined,
  );
});

test('atomic: invalid preferences leave project memory unwritten', async () => {
  const memoryStore = new InMemoryMemoryStore();

  const response = await handleEditMemory({
    memoryStore,
    body: {
      projectName: PROJECT_NAME,
      preferences: { cursor: [42] },
      project: { dailySummary: 'Did work today.' },
    },
  });

  assert.equal(response.status, 'error');
  assert.equal(
    await memoryStore.getProjectMemory({ userId: USER_ID, projectId: PROJECT_ID }),
    undefined,
  );
  assert.equal(await memoryStore.getUserMemory({ userId: USER_ID }), undefined);
});

test('saving preferences only persists them and surfaces them in the status', async () => {
  const memoryStore = new InMemoryMemoryStore();

  const response = await handleEditMemory({
    memoryStore,
    body: { preferences: { general: { preferredTone: 'concise' }, cursor: ['task-first'] } },
  });

  assert.equal(response.status, 'success');
  if (response.status !== 'success') return;
  assert.match(response.message, /saved preferences/i);
  assert.deepEqual(response.memory.promptPreferences, {
    general: { preferredTone: 'concise' },
    cursor: ['task-first'],
  });

  const stored = await memoryStore.getUserMemory({ userId: USER_ID });
  assert.deepEqual(stored?.promptPreferences, {
    general: { preferredTone: 'concise' },
    cursor: ['task-first'],
  });
});

test('saving both sections reports both were saved', async () => {
  const memoryStore = new InMemoryMemoryStore();

  const response = await handleEditMemory({
    memoryStore,
    body: {
      projectName: PROJECT_NAME,
      preferences: { cursor: ['task-first'] },
      project: { dailySummary: 'Shipped the cache.', date: '2026-07-07' },
    },
  });

  assert.equal(response.status, 'success');
  if (response.status !== 'success') return;
  assert.match(response.message, /preferences and project memory/i);
  assert.ok(await memoryStore.getUserMemory({ userId: USER_ID }));
  assert.ok(await memoryStore.getProjectMemory({ userId: USER_ID, projectId: PROJECT_ID }));
});

test('a saved activeSpecSummary is persisted and read back into the status', async () => {
  const memoryStore = new InMemoryMemoryStore();

  const response = await handleEditMemory({
    memoryStore,
    body: { projectName: PROJECT_NAME, project: { activeSpecSummary: 'Ship the TTL cache.' } },
  });

  assert.equal(response.status, 'success');
  if (response.status !== 'success') return;
  assert.equal(response.memory.activeSpecSummary, 'Ship the TTL cache.');

  const stored = await memoryStore.getProjectMemory({ userId: USER_ID, projectId: PROJECT_ID });
  assert.equal(stored?.activeSpecSummary, 'Ship the TTL cache.');
});

test('a stored activeSpecSummary takes precedence over the run-derived one', async () => {
  const memoryStore = new InMemoryMemoryStore();
  await handleEditMemory({
    memoryStore,
    body: { projectName: PROJECT_NAME, project: { activeSpecSummary: 'User-edited spec.' } },
  });

  // A later analyze run passes its own (run-derived) summary, but the stored,
  // user-edited spec summary should win and be surfaced in the panel.
  const response = await handleAnalyze({
    runner: new MockAnalysisRunner(),
    mode: 'mock',
    body: { requirementText: 'Add a cache', rawDiff: 'diff --git a b', projectName: PROJECT_NAME },
    memoryStore,
  });

  assert.equal(response.status, 'success');
  if (response.status !== 'success') return;
  assert.equal(response.memory.activeSpecSummary, 'User-edited spec.');
});

test('the current-run activeSpecSummary is used when stored memory has none', async () => {
  const memoryStore = new InMemoryMemoryStore();

  const response = await handleAnalyze({
    runner: new MockAnalysisRunner(),
    mode: 'mock',
    body: { requirementText: 'Add a cache', rawDiff: 'diff --git a b', projectName: 'Fresh Project' },
    memoryStore,
  });

  assert.equal(response.status, 'success');
  if (response.status !== 'success') return;
  // No stored memory, so the run-derived summary is the fallback shown.
  assert.ok(response.memory.activeSpecSummary);
});
