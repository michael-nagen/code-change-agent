import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DefaultGitInputAdapter } from '../GitInputAdapter.js';
import type { GitDiffReaderInput, GitDiffReaderTool, GitDiffResult } from '../types.js';

const DIFF_RESULT: GitDiffResult = {
  rawDiff: 'diff --git a/file.ts b/file.ts',
  changedFiles: ['file.ts'],
  stats: { filesChanged: 1, additions: 3, deletions: 1 },
};

/** A spy GitDiffReaderTool that records its inputs and returns fixed data. */
function makeSpyReader() {
  const calls: Array<GitDiffReaderInput | undefined> = [];
  const tool: GitDiffReaderTool = {
    name: 'spy-git-diff-reader',
    async execute(input?: GitDiffReaderInput): Promise<GitDiffResult> {
      calls.push(input);
      return structuredClone(DIFF_RESULT);
    },
  };
  return { tool, calls };
}

test('reads the diff via GitDiffReaderTool, mapping repoPath/baseRef/headRef', async () => {
  const reader = makeSpyReader();
  const adapter = new DefaultGitInputAdapter({ gitDiffReader: reader.tool });

  await adapter.execute({
    repoPath: '/repo',
    baseRef: 'main',
    headRef: 'feature',
    requirementText: 'Add a planning stage.',
  });

  assert.equal(reader.calls.length, 1);
  assert.deepEqual(reader.calls[0], {
    cwd: '/repo',
    baseRef: 'main',
    targetRef: 'feature',
  });
});

test('omits refs when not provided so the tool reads the working tree', async () => {
  const reader = makeSpyReader();
  const adapter = new DefaultGitInputAdapter({ gitDiffReader: reader.tool });

  await adapter.execute({ repoPath: '/repo', requirementText: 'Add a planning stage.' });

  assert.deepEqual(reader.calls[0], { cwd: '/repo' });
});

test('returns normalized git analysis input tagged with source "git"', async () => {
  const reader = makeSpyReader();
  const adapter = new DefaultGitInputAdapter({ gitDiffReader: reader.tool });

  const result = await adapter.execute({
    repoPath: '/repo',
    requirementText: 'Add a planning stage.',
  });

  assert.deepEqual(result, {
    rawDiff: DIFF_RESULT.rawDiff,
    changedFiles: DIFF_RESULT.changedFiles,
    stats: DIFF_RESULT.stats,
    requirementText: 'Add a planning stage.',
    source: 'git',
  });
});

test('preserves requirementText verbatim — no normalization, no reasoning', async () => {
  const reader = makeSpyReader();
  const adapter = new DefaultGitInputAdapter({ gitDiffReader: reader.tool });

  const result = await adapter.execute({
    repoPath: '/repo',
    requirementText: '  keep   my   spacing  ',
  });

  assert.equal(result.requirementText, '  keep   my   spacing  ');
});
