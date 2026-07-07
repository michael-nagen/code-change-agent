import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { FormSubmission } from '../types.js';
import {
  normalizeInput,
  toGitHubDiffUrl,
  extractReadableText,
  type FetchLike,
  type MinimalResponse,
} from '../normalizeInput.js';

function submission(overrides: Partial<FormSubmission>): FormSubmission {
  return {
    inputMode: 'manual',
    requirementText: '',
    rawDiff: '',
    githubUrl: '',
    websiteUrl: '',
    notionText: '',
    includeFlow: false,
    includeGapReport: false,
    includePrDescription: false,
    includeVideoScript: false,
    includeDailyUpdate: false,
    includeDailyWorkGuidance: false,
    includeTechnicalChangeBrief: false,
    includeDemoPrepLoop: false,
    includeWeeklyReview: false,
    ...overrides,
  };
}

/** A fetch mock that records calls and returns a scripted response. */
function mockFetch(
  resp: Partial<MinimalResponse> & { body?: string },
): { fetchImpl: FetchLike; calls: string[] } {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (url) => {
    calls.push(url);
    return {
      ok: resp.ok ?? true,
      status: resp.status ?? 200,
      text: async () => resp.body ?? '',
    };
  };
  return { fetchImpl, calls };
}

// --- URL conversion -------------------------------------------------------

test('toGitHubDiffUrl converts a PR URL to .diff', () => {
  assert.equal(
    toGitHubDiffUrl('https://github.com/owner/repo/pull/123'),
    'https://github.com/owner/repo/pull/123.diff',
  );
});

test('toGitHubDiffUrl converts a commit URL to .diff', () => {
  assert.equal(
    toGitHubDiffUrl('https://github.com/owner/repo/commit/abcdef1234567'),
    'https://github.com/owner/repo/commit/abcdef1234567.diff',
  );
});

test('toGitHubDiffUrl tolerates trailing slash and existing .diff', () => {
  assert.equal(
    toGitHubDiffUrl('https://github.com/o/r/pull/9/'),
    'https://github.com/o/r/pull/9.diff',
  );
  assert.equal(
    toGitHubDiffUrl('https://github.com/o/r/pull/9.diff'),
    'https://github.com/o/r/pull/9.diff',
  );
});

test('toGitHubDiffUrl rejects non-github hosts and unsupported paths', () => {
  assert.throws(() => toGitHubDiffUrl('https://gitlab.com/o/r/pull/1'), /github\.com/);
  assert.throws(() => toGitHubDiffUrl('https://github.com/o/r/issues/1'), /Unsupported/);
  assert.throws(() => toGitHubDiffUrl('not a url'), /Invalid/);
});

// --- GitHub mode ----------------------------------------------------------

test('githubUrl mode fetches the .diff and uses it as rawDiff', async () => {
  const { fetchImpl, calls } = mockFetch({ body: 'diff --git a/x b/x\n+hello' });
  const result = await normalizeInput({
    submission: submission({
      inputMode: 'githubUrl',
      githubUrl: 'https://github.com/owner/repo/pull/123',
      requirementText: 'Add hello',
    }),
    fetchImpl,
  });
  assert.deepEqual(calls, ['https://github.com/owner/repo/pull/123.diff']);
  assert.match(result.rawDiff, /diff --git/);
  assert.equal(result.requirementText, 'Add hello');
});

test('githubUrl commit mode fetches the commit .diff', async () => {
  const { fetchImpl, calls } = mockFetch({ body: 'diff --git a/y b/y\n+world' });
  const result = await normalizeInput({
    submission: submission({
      inputMode: 'githubUrl',
      githubUrl: 'https://github.com/owner/repo/commit/abc1234',
      requirementText: 'req',
    }),
    fetchImpl,
  });
  assert.deepEqual(calls, ['https://github.com/owner/repo/commit/abc1234.diff']);
  assert.match(result.rawDiff, /world/);
});

test('invalid GitHub URL fails clearly before fetching', async () => {
  const { fetchImpl, calls } = mockFetch({ body: 'unused' });
  await assert.rejects(
    normalizeInput({
      submission: submission({ inputMode: 'githubUrl', githubUrl: 'https://example.com/x' }),
      fetchImpl,
    }),
    /github\.com/,
  );
  assert.equal(calls.length, 0);
});

test('GitHub 404 surfaces a private/not-found message', async () => {
  const { fetchImpl } = mockFetch({ ok: false, status: 404 });
  await assert.rejects(
    normalizeInput({
      submission: submission({
        inputMode: 'githubUrl',
        githubUrl: 'https://github.com/owner/repo/pull/1',
      }),
      fetchImpl,
    }),
    /404|private|not exist/i,
  );
});

test('empty fetched diff fails clearly', async () => {
  const { fetchImpl } = mockFetch({ body: '   \n  ' });
  await assert.rejects(
    normalizeInput({
      submission: submission({
        inputMode: 'githubUrl',
        githubUrl: 'https://github.com/owner/repo/pull/1',
      }),
      fetchImpl,
    }),
    /empty/i,
  );
});

// --- Website mode ---------------------------------------------------------

test('extractReadableText strips tags/scripts and decodes entities', () => {
  const html =
    '<html><head><style>.x{}</style><script>bad()</script></head>' +
    '<body><h1>Title</h1><p>Hello&nbsp;&amp; welcome</p></body></html>';
  const text = extractReadableText(html);
  assert.match(text, /Title/);
  assert.match(text, /Hello & welcome/);
  assert.doesNotMatch(text, /bad\(\)/);
  assert.doesNotMatch(text, /<p>/);
});

test('websiteContextUrl mode extracts text as requirement, keeps textarea diff', async () => {
  const { fetchImpl, calls } = mockFetch({
    body: '<html><body><p>Build a login page with SSO.</p></body></html>',
  });
  const result = await normalizeInput({
    submission: submission({
      inputMode: 'websiteContextUrl',
      websiteUrl: 'https://example.com/spec',
      rawDiff: 'diff --git a/login b/login',
    }),
    fetchImpl,
  });
  assert.deepEqual(calls, ['https://example.com/spec']);
  assert.match(result.requirementText, /Build a login page with SSO\./);
  assert.equal(result.rawDiff, 'diff --git a/login b/login');
});

test('website mode still requires a rawDiff (no fetch without it)', async () => {
  const { fetchImpl, calls } = mockFetch({ body: '<p>spec</p>' });
  await assert.rejects(
    normalizeInput({
      submission: submission({
        inputMode: 'websiteContextUrl',
        websiteUrl: 'https://example.com/spec',
        rawDiff: '   ',
      }),
      fetchImpl,
    }),
    /requires a raw diff/i,
  );
  assert.equal(calls.length, 0);
});

test('website mode rejects non-http(s) URLs', async () => {
  const { fetchImpl } = mockFetch({ body: '<p>x</p>' });
  await assert.rejects(
    normalizeInput({
      submission: submission({
        inputMode: 'websiteContextUrl',
        websiteUrl: 'ftp://example.com/spec',
        rawDiff: 'diff',
      }),
      fetchImpl,
    }),
    /http or https/i,
  );
});

test('website mode fails clearly when extracted text is empty', async () => {
  const { fetchImpl } = mockFetch({ body: '<html><head></head><body></body></html>' });
  await assert.rejects(
    normalizeInput({
      submission: submission({
        inputMode: 'websiteContextUrl',
        websiteUrl: 'https://example.com/empty',
        rawDiff: 'diff',
      }),
      fetchImpl,
    }),
    /No readable text/i,
  );
});

// --- Notion + manual (no network) ----------------------------------------

test('notionText mode passes pasted text as requirement and textarea as diff', async () => {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (url) => {
    calls.push(url);
    return { ok: true, status: 200, text: async () => '' };
  };
  const result = await normalizeInput({
    submission: submission({
      inputMode: 'notionText',
      notionText: 'As a user I want to reset my password.',
      rawDiff: 'diff --git a/reset b/reset',
    }),
    fetchImpl,
  });
  assert.equal(result.requirementText, 'As a user I want to reset my password.');
  assert.equal(result.rawDiff, 'diff --git a/reset b/reset');
  assert.equal(calls.length, 0, 'notion mode must not touch the network');
});

test('manual mode is identity and does no network', async () => {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (url) => {
    calls.push(url);
    return { ok: true, status: 200, text: async () => '' };
  };
  const result = await normalizeInput({
    submission: submission({
      inputMode: 'manual',
      requirementText: 'req',
      rawDiff: 'diff',
    }),
    fetchImpl,
  });
  assert.deepEqual(result, { requirementText: 'req', rawDiff: 'diff' });
  assert.equal(calls.length, 0);
});
