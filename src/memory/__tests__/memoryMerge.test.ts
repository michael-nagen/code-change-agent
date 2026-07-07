import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  appendSnapshot,
  buildDeveloperMemoryContext,
  renderPreviousProgressMemory,
} from '../memoryMerge.js';
import type { ProjectMemory, ProjectProgressSnapshot } from '../types/index.js';

const SNAPSHOT: ProjectProgressSnapshot = {
  date: '2026-07-07',
  dailySummary: 'Planning stage done; persistence pending.',
  updatedChecklistStatuses: [
    { item: 'Planning', status: 'done' },
    { item: 'Persistence', status: 'partial' },
  ],
  openBlockers: ['Plans lost on restart'],
  openDecisions: ['Where to store plans'],
  nextActions: ['Persist plans to disk'],
};

const PROJECT_MEMORY: ProjectMemory = {
  schemaVersion: 1,
  userId: 'local',
  projectId: 'demo',
  latestSnapshot: SNAPSHOT,
  history: [],
  updatedAt: '2026-07-07T00:00:00.000Z',
};

test('renderPreviousProgressMemory produces a readable, grounded block', () => {
  const text = renderPreviousProgressMemory(SNAPSHOT);
  assert.match(text, /Previous progress \(as of 2026-07-07\)/);
  assert.match(text, /Planning: done/);
  assert.match(text, /Plans lost on restart/);
  assert.match(text, /Persist plans to disk/);
});

test('buildDeveloperMemoryContext derives previousProgressMemory from the latest snapshot', () => {
  const ctx = buildDeveloperMemoryContext({
    userId: 'local',
    projectId: 'demo',
    projectMemory: PROJECT_MEMORY,
  });
  assert.ok(ctx.previousProgressMemory);
  assert.match(ctx.previousProgressMemory, /Planning stage done/);
  assert.equal(ctx.projectMemory, PROJECT_MEMORY);
});

test('buildDeveloperMemoryContext notes absence rather than inventing memory', () => {
  const noProject = buildDeveloperMemoryContext({ userId: 'local' });
  assert.equal(noProject.previousProgressMemory, undefined);
  assert.ok(noProject.notes.some((n) => /No project id resolved/.test(n)));

  const { latestSnapshot: _omit, ...withoutLatest } = PROJECT_MEMORY;
  const emptyProject = buildDeveloperMemoryContext({
    userId: 'local',
    projectId: 'demo',
    projectMemory: { ...withoutLatest, history: [] },
  });
  assert.equal(emptyProject.previousProgressMemory, undefined);
  assert.ok(emptyProject.notes.some((n) => /no saved progress snapshot/.test(n)));
});

test('appendSnapshot moves the prior latest into history and stamps the new latest', () => {
  const next: ProjectProgressSnapshot = { ...SNAPSHOT, date: '2026-07-08', dailySummary: 'Day two.' };
  const updated = appendSnapshot({
    userId: 'local',
    projectId: 'demo',
    snapshot: next,
    existing: PROJECT_MEMORY,
    now: '2026-07-08T00:00:00.000Z',
  });

  assert.deepEqual(updated.latestSnapshot, next);
  assert.deepEqual(updated.history, [SNAPSHOT]);
  assert.equal(updated.updatedAt, '2026-07-08T00:00:00.000Z');
  assert.equal(updated.schemaVersion, 1);
});

test('appendSnapshot bounds history length', () => {
  let memory: ProjectMemory | undefined;
  for (let i = 0; i < 5; i++) {
    memory = appendSnapshot({
      userId: 'local',
      projectId: 'demo',
      snapshot: { ...SNAPSHOT, date: `2026-07-0${i}` },
      existing: memory,
      maxHistory: 2,
    });
  }
  assert.ok(memory);
  assert.ok(memory.history.length <= 2);
});
