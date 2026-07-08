import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  HttpGitHubConnector,
  toGitHubDiffUrl,
  parseChangedFiles,
} from '../connectors/HttpGitHubConnector.js';
import { SourceError } from '../../errors/SourceError.js';
import type { SourceFetch, SourceResponse } from '../types.js';

function fetchReturning(resp: Partial<SourceResponse> & { body?: string }): {
  fetchImpl: SourceFetch;
  calls: { url: string; init?: unknown }[];
} {
  const calls: { url: string; init?: unknown }[] = [];
  const fetchImpl: SourceFetch = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: resp.ok ?? true,
      status: resp.status ?? 200,
      text: async () => resp.body ?? '',
      json: async () => ({}),
    };
  };
  return { fetchImpl, calls };
}

const SAMPLE_DIFF = [
  'diff --git a/src/a.ts b/src/a.ts',
  'index 111..222 100644',
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -1 +1 @@',
  '-old',
  '+new',
  'diff --git a/src/b.ts b/src/b.ts',
  'new file mode 100644',
  '+++ b/src/b.ts',
  '@@ -0,0 +1 @@',
  '+brand new',
].join('\n');

test('toGitHubDiffUrl converts PR and commit URLs and rejects others', () => {
  assert.equal(toGitHubDiffUrl('https://github.com/o/r/pull/12'), 'https://github.com/o/r/pull/12.diff');
  assert.equal(
    toGitHubDiffUrl('https://github.com/o/r/commit/abcdef1'),
    'https://github.com/o/r/commit/abcdef1.diff',
  );
  assert.throws(() => toGitHubDiffUrl('https://gitlab.com/o/r/pull/1'), SourceError);
  assert.throws(() => toGitHubDiffUrl('not a url'), SourceError);
});

test('parseChangedFiles extracts paths and status from a unified diff', () => {
  const files = parseChangedFiles(SAMPLE_DIFF);
  assert.deepEqual(
    files.map((f) => ({ path: f.path, status: f.status })),
    [
      { path: 'src/a.ts', status: 'modified' },
      { path: 'src/b.ts', status: 'added' },
    ],
  );
});

test('readPullRequest fetches the .diff and builds a PR source', async () => {
  const { fetchImpl, calls } = fetchReturning({ body: SAMPLE_DIFF });
  const connector = new HttpGitHubConnector({ fetchImpl });

  const pr = await connector.readPullRequest({ url: 'https://github.com/o/r/pull/12' });

  assert.equal(calls[0]?.url, 'https://github.com/o/r/pull/12.diff');
  assert.equal(pr.source.kind, 'github');
  assert.match(pr.title, /PR #12/);
  assert.equal(pr.combinedDiffText, SAMPLE_DIFF);
  assert.equal(pr.changedFiles.length, 2);
});

test('a 404 surfaces a clear NOT_FOUND error', async () => {
  const { fetchImpl } = fetchReturning({ ok: false, status: 404 });
  const connector = new HttpGitHubConnector({ fetchImpl });
  await assert.rejects(
    () => connector.readPullRequest({ url: 'https://github.com/o/r/pull/12' }),
    (err: unknown) => err instanceof SourceError && err.code === 'NOT_FOUND',
  );
});

test('sends a bearer token when configured', async () => {
  const { fetchImpl, calls } = fetchReturning({ body: SAMPLE_DIFF });
  const connector = new HttpGitHubConnector({ token: 'ghp_x', fetchImpl });
  await connector.readPullRequest({ url: 'https://github.com/o/r/pull/12' });
  const headers = (calls[0]?.init as { headers?: Record<string, string> } | undefined)?.headers;
  assert.equal(headers?.Authorization, 'Bearer ghp_x');
});
