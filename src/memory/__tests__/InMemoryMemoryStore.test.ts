import { test } from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryMemoryStore } from '../InMemoryMemoryStore.js';
import { MemoryStoreError } from '../../errors/MemoryStoreError.js';
import type { ProjectMemory, UserPreferencesMemory } from '../types/index.js';

const USER_MEMORY: UserPreferencesMemory = {
  schemaVersion: 1,
  userId: 'local',
  preferences: ['prefers concise updates'],
  updatedAt: '2026-07-07T00:00:00.000Z',
};

const PROJECT_MEMORY: ProjectMemory = {
  schemaVersion: 1,
  userId: 'local',
  projectId: 'demo',
  latestSnapshot: {
    date: '2026-07-07',
    dailySummary: 'Planning stage done.',
    updatedChecklistStatuses: [{ item: 'Planning', status: 'done' }],
    openBlockers: [],
    openDecisions: [],
    nextActions: ['Persist plans'],
  },
  history: [],
  updatedAt: '2026-07-07T00:00:00.000Z',
};

test('returns undefined for unknown user and project memory', async () => {
  const store = new InMemoryMemoryStore();
  assert.equal(await store.getUserMemory({ userId: 'nobody' }), undefined);
  assert.equal(await store.getProjectMemory({ userId: 'nobody', projectId: 'x' }), undefined);
});

test('round-trips user and project memory', async () => {
  const store = new InMemoryMemoryStore();
  await store.saveUserMemory({ userId: 'local', memory: USER_MEMORY });
  await store.saveProjectMemory({ userId: 'local', projectId: 'demo', memory: PROJECT_MEMORY });

  assert.deepEqual(await store.getUserMemory({ userId: 'local' }), USER_MEMORY);
  assert.deepEqual(await store.getProjectMemory({ userId: 'local', projectId: 'demo' }), PROJECT_MEMORY);
});

test('project memory is scoped by user + project', async () => {
  const store = new InMemoryMemoryStore();
  await store.saveProjectMemory({ userId: 'local', projectId: 'demo', memory: PROJECT_MEMORY });

  assert.equal(await store.getProjectMemory({ userId: 'other', projectId: 'demo' }), undefined);
  assert.equal(await store.getProjectMemory({ userId: 'local', projectId: 'else' }), undefined);
});

test('returns isolated snapshots so callers cannot mutate stored state', async () => {
  const store = new InMemoryMemoryStore();
  await store.saveProjectMemory({ userId: 'local', projectId: 'demo', memory: PROJECT_MEMORY });

  const fetched = await store.getProjectMemory({ userId: 'local', projectId: 'demo' });
  assert.ok(fetched);
  fetched.history.push({
    date: 'x',
    dailySummary: 'leak',
    updatedChecklistStatuses: [],
    openBlockers: [],
    openDecisions: [],
    nextActions: [],
  });

  const again = await store.getProjectMemory({ userId: 'local', projectId: 'demo' });
  assert.ok(again);
  assert.deepEqual(again.history, []);
});

test('clearProjectMemory removes only the targeted record', async () => {
  const store = new InMemoryMemoryStore();
  await store.saveProjectMemory({ userId: 'local', projectId: 'demo', memory: PROJECT_MEMORY });
  await store.clearProjectMemory?.({ userId: 'local', projectId: 'demo' });
  assert.equal(await store.getProjectMemory({ userId: 'local', projectId: 'demo' }), undefined);
});

test('fails closed when saving an invalid shape', async () => {
  const store = new InMemoryMemoryStore();
  const bad = { schemaVersion: 1, userId: 'local' } as unknown as ProjectMemory;
  await assert.rejects(
    () => store.saveProjectMemory({ userId: 'local', projectId: 'demo', memory: bad }),
    (err: unknown) => err instanceof MemoryStoreError && err.code === 'VALIDATION',
  );
});
