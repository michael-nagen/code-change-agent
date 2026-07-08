import { test } from 'node:test';
import assert from 'node:assert/strict';

import { handleClearMemory } from '../handleClearMemory.js';
import { handleAnalyze } from '../handleAnalyze.js';
import { MockAnalysisRunner } from '../analysisRunner.js';
import { InMemoryMemoryStore } from '../../memory/index.js';
import type { ProjectMemory, UserPreferencesMemory } from '../../memory/index.js';

function seededStore(): InMemoryMemoryStore {
  const store = new InMemoryMemoryStore();
  const memory: ProjectMemory = {
    schemaVersion: 1,
    userId: 'local',
    projectId: 'checkout-service',
    latestSnapshot: {
      date: '2026-07-07',
      dailySummary: 'Built the cache.',
      updatedChecklistStatuses: [{ item: 'Cache', status: 'done' }],
      openBlockers: ['Eviction missing'],
      openDecisions: ['Storage choice'],
      nextActions: ['Add eviction'],
    },
    history: [],
    updatedAt: '2026-07-07T00:00:00.000Z',
  };
  // Seed synchronously enough for tests (save is async but resolves immediately).
  void store.saveProjectMemory({ userId: 'local', projectId: 'checkout-service', memory });
  return store;
}

test('clears the active project memory and returns an empty status', async () => {
  const memoryStore = seededStore();

  const response = await handleClearMemory({
    memoryStore,
    body: { projectName: 'Checkout Service' },
  });

  assert.equal(response.status, 'success');
  if (response.status !== 'success') return;
  assert.equal(response.memory.snapshot, undefined);
  assert.equal(response.memory.loadedForThisRun, false);
  assert.equal(
    await memoryStore.getProjectMemory({ userId: 'local', projectId: 'checkout-service' }),
    undefined,
  );
});

test('clearing project memory does not touch user memory', async () => {
  const memoryStore = seededStore();
  const userMemory: UserPreferencesMemory = {
    schemaVersion: 1,
    userId: 'local',
    preferences: ['concise'],
    updatedAt: '2026-07-07T00:00:00.000Z',
  };
  await memoryStore.saveUserMemory({ userId: 'local', memory: userMemory });

  await handleClearMemory({ memoryStore, body: { projectName: 'Checkout Service' } });

  assert.deepEqual(await memoryStore.getUserMemory({ userId: 'local' }), userMemory);
});

test('requires a project name to clear (per-project memory)', async () => {
  const response = await handleClearMemory({
    memoryStore: new InMemoryMemoryStore(),
    body: { projectName: '' },
  });
  assert.equal(response.status, 'error');
  if (response.status !== 'error') return;
  assert.match(response.message, /project name/i);
});

test('never throws on a malformed body', async () => {
  const response = await handleClearMemory({ memoryStore: new InMemoryMemoryStore(), body: null });
  assert.equal(response.status, 'error');
});

test('the analyze response surfaces stored project memory (loaded for this run)', async () => {
  const memoryStore = seededStore();
  const response = await handleAnalyze({
    runner: new MockAnalysisRunner(),
    mode: 'mock',
    body: { requirementText: 'Add a cache', rawDiff: 'diff --git a b', projectName: 'Checkout Service' },
    memoryStore,
  });

  assert.equal(response.status, 'success');
  if (response.status !== 'success') return;
  assert.equal(response.memory.projectName, 'Checkout Service');
  assert.equal(response.memory.projectId, 'checkout-service');
  assert.ok(response.memory.snapshot);
  assert.equal(response.memory.snapshot.latestSummary, 'Built the cache.');
  assert.equal(response.memory.loadedForThisRun, true);
  assert.ok(response.memory.activeSpecSummary);
});

test('the analyze response reports an empty memory status when none is saved', async () => {
  const response = await handleAnalyze({
    runner: new MockAnalysisRunner(),
    mode: 'mock',
    body: { requirementText: 'Add a cache', rawDiff: 'diff --git a b', projectName: 'Fresh Project' },
    memoryStore: new InMemoryMemoryStore(),
  });

  assert.equal(response.status, 'success');
  if (response.status !== 'success') return;
  assert.equal(response.memory.snapshot, undefined);
  assert.equal(response.memory.loadedForThisRun, false);
});
