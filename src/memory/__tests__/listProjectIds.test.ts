import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { InMemoryMemoryStore } from '../InMemoryMemoryStore.js';
import { JsonFileMemoryStore } from '../JsonFileMemoryStore.js';
import { MEMORY_SCHEMA_VERSION } from '../types/index.js';
import type { ProjectMemory } from '../types/index.js';

function projectMemory(projectId: string): ProjectMemory {
  return {
    schemaVersion: MEMORY_SCHEMA_VERSION,
    userId: 'u1',
    projectId,
    history: [],
    updatedAt: new Date().toISOString(),
  };
}

test('InMemoryMemoryStore.listProjectIds returns only the user\'s projects, sorted', async () => {
  const store = new InMemoryMemoryStore();
  await store.saveProjectMemory({ userId: 'u1', projectId: 'beta', memory: projectMemory('beta') });
  await store.saveProjectMemory({ userId: 'u1', projectId: 'alpha', memory: projectMemory('alpha') });
  await store.saveProjectMemory({ userId: 'u2', projectId: 'other', memory: projectMemory('other') });

  assert.deepEqual(await store.listProjectIds({ userId: 'u1' }), ['alpha', 'beta']);
  assert.deepEqual(await store.listProjectIds({ userId: 'nobody' }), []);
});

test('JsonFileMemoryStore.listProjectIds lists saved project files and ignores a missing dir', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mem-list-'));
  try {
    const store = new JsonFileMemoryStore({ dataDir: dir });
    assert.deepEqual(await store.listProjectIds({ userId: 'u1' }), []);

    await store.saveProjectMemory({ userId: 'u1', projectId: 'zeta', memory: projectMemory('zeta') });
    await store.saveProjectMemory({ userId: 'u1', projectId: 'alpha', memory: projectMemory('alpha') });

    assert.deepEqual(await store.listProjectIds({ userId: 'u1' }), ['alpha', 'zeta']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
