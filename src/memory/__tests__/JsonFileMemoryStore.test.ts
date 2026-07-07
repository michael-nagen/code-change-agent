import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { JsonFileMemoryStore } from '../JsonFileMemoryStore.js';
import { MemoryStoreError } from '../../errors/MemoryStoreError.js';
import type { ProjectMemory, UserPreferencesMemory } from '../types/index.js';

const USER_MEMORY: UserPreferencesMemory = {
  schemaVersion: 1,
  userId: 'local',
  preferences: ['prefers concise updates'],
  defaultGoal: 'ship the MVP',
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

/** Run `fn` against a fresh, isolated temp data dir; always clean it up. */
async function withTempDir(fn: (dataDir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'memtest-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('missing memory reads as undefined (no crash)', async () => {
  await withTempDir(async (dataDir) => {
    const store = new JsonFileMemoryStore({ dataDir });
    assert.equal(await store.getUserMemory({ userId: 'local' }), undefined);
    assert.equal(await store.getProjectMemory({ userId: 'local', projectId: 'demo' }), undefined);
  });
});

test('persists and reloads user + project memory across store instances', async () => {
  await withTempDir(async (dataDir) => {
    const writer = new JsonFileMemoryStore({ dataDir });
    await writer.saveUserMemory({ userId: 'local', memory: USER_MEMORY });
    await writer.saveProjectMemory({ userId: 'local', projectId: 'demo', memory: PROJECT_MEMORY });

    // A brand-new instance proves durability is on disk, not in memory.
    const reader = new JsonFileMemoryStore({ dataDir });
    assert.deepEqual(await reader.getUserMemory({ userId: 'local' }), USER_MEMORY);
    assert.deepEqual(
      await reader.getProjectMemory({ userId: 'local', projectId: 'demo' }),
      PROJECT_MEMORY,
    );
  });
});

test('atomic write leaves no temp files behind', async () => {
  await withTempDir(async (dataDir) => {
    const store = new JsonFileMemoryStore({ dataDir });
    await store.saveProjectMemory({ userId: 'local', projectId: 'demo', memory: PROJECT_MEMORY });
    const files = await readdir(join(dataDir, 'projects', 'local'));
    assert.deepEqual(files, ['demo.json']);
  });
});

test('a corrupted JSON file surfaces a clear CORRUPTED error (does not crash silently)', async () => {
  await withTempDir(async (dataDir) => {
    const dir = join(dataDir, 'projects', 'local');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'demo.json'), '{ not json', 'utf8');

    const store = new JsonFileMemoryStore({ dataDir });
    await assert.rejects(
      () => store.getProjectMemory({ userId: 'local', projectId: 'demo' }),
      (err: unknown) => err instanceof MemoryStoreError && err.code === 'CORRUPTED',
    );
  });
});

test('a structurally invalid file surfaces a CORRUPTED error', async () => {
  await withTempDir(async (dataDir) => {
    const dir = join(dataDir, 'projects', 'local');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'demo.json'), JSON.stringify({ schemaVersion: 1 }), 'utf8');

    const store = new JsonFileMemoryStore({ dataDir });
    await assert.rejects(
      () => store.getProjectMemory({ userId: 'local', projectId: 'demo' }),
      (err: unknown) => err instanceof MemoryStoreError && err.code === 'CORRUPTED',
    );
  });
});

test('rejects unsafe ids to prevent path traversal', async () => {
  await withTempDir(async (dataDir) => {
    const store = new JsonFileMemoryStore({ dataDir });
    await assert.rejects(
      () => store.getProjectMemory({ userId: '../../etc', projectId: 'demo' }),
      (err: unknown) => err instanceof MemoryStoreError && err.code === 'VALIDATION',
    );
  });
});

test('clearProjectMemory deletes the file and is safe when absent', async () => {
  await withTempDir(async (dataDir) => {
    const store = new JsonFileMemoryStore({ dataDir });
    await store.saveProjectMemory({ userId: 'local', projectId: 'demo', memory: PROJECT_MEMORY });
    await store.clearProjectMemory?.({ userId: 'local', projectId: 'demo' });
    assert.equal(await store.getProjectMemory({ userId: 'local', projectId: 'demo' }), undefined);
    // Second clear on a missing file must not throw.
    await store.clearProjectMemory?.({ userId: 'local', projectId: 'demo' });
  });
});
