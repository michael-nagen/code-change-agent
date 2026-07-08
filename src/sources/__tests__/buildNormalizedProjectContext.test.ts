import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildNormalizedProjectContext } from '../buildNormalizedProjectContext.js';
import type { DeveloperMemoryContext } from '../../memory/index.js';
import type { NormalizedProjectSource } from '../types.js';

const MEMORY: DeveloperMemoryContext = {
  userId: 'local',
  projectId: 'demo',
  previousProgressMemory: 'Previous progress: planning done.',
  notes: [],
};

const GITHUB_SOURCE: NormalizedProjectSource = {
  source: { kind: 'github', title: 'owner/repo PR #1', url: 'https://github.com/o/r/pull/1' },
  text: 'diff --git a/x b/x',
};

test('normalizes manual requirement and diff as sources (source of truth)', () => {
  const ctx = buildNormalizedProjectContext({
    manualRequirementText: 'Add a cache',
    manualDiffText: 'diff --git a/c b/c',
  });
  assert.equal(ctx.requirementText, 'Add a cache');
  assert.equal(ctx.diffText, 'diff --git a/c b/c');
  const kinds = ctx.sources.map((s) => s.source.kind);
  assert.deepEqual(kinds, ['manual', 'manual']);
  assert.match(ctx.sourceSummary ?? '', /manual input/);
});

test('adds memory as a supporting normalized source', () => {
  const ctx = buildNormalizedProjectContext({
    manualRequirementText: 'Add a cache',
    manualDiffText: 'diff',
    memoryContext: MEMORY,
  });
  assert.equal(ctx.memoryText, 'Previous progress: planning done.');
  const memory = ctx.sources.find((s) => s.source.kind === 'memory');
  assert.ok(memory);
  assert.equal(memory.source.id, 'demo');
  assert.match(ctx.sourceSummary ?? '', /project memory/);
});

test('appends external sources and preserves their metadata', () => {
  const ctx = buildNormalizedProjectContext({
    manualRequirementText: 'Add a cache',
    manualDiffText: 'diff',
    externalSources: [GITHUB_SOURCE],
  });
  const github = ctx.sources.find((s) => s.source.kind === 'github');
  assert.ok(github);
  assert.equal(github.source.url, 'https://github.com/o/r/pull/1');
  assert.match(ctx.sourceSummary ?? '', /GitHub/);
});

test('missing external sources do not break the manual flow', () => {
  const ctx = buildNormalizedProjectContext({ manualRequirementText: 'Add a cache', manualDiffText: 'diff' });
  assert.equal(ctx.sources.length, 2);
});

test('an empty context reports no sources', () => {
  const ctx = buildNormalizedProjectContext({});
  assert.deepEqual(ctx.sources, []);
  assert.match(ctx.sourceSummary ?? '', /No sources/);
  assert.equal(ctx.requirementText, undefined);
});
