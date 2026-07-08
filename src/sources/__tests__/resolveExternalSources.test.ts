import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveExternalSources } from '../resolveExternalSources.js';
import { MockNotionConnector, MockGitHubConnector } from '../mocks.js';
import { SourceError } from '../../errors/SourceError.js';
import type { GitHubConnector, NotionConnector } from '../types.js';

test('resolves configured Notion and GitHub sources', async () => {
  const { sources, warnings } = await resolveExternalSources({
    notionConnector: new MockNotionConnector('Spec text.'),
    githubConnector: new MockGitHubConnector(),
    notionPageId: 'page-1',
    githubPrUrl: 'https://github.com/o/r/pull/1',
  });

  assert.equal(warnings.length, 0);
  const kinds = sources.map((s) => s.source.kind).sort();
  assert.deepEqual(kinds, ['github', 'notion']);
  const notion = sources.find((s) => s.source.kind === 'notion');
  assert.equal(notion?.text, 'Spec text.');
});

test('resolves nothing when ids are not provided', async () => {
  const { sources } = await resolveExternalSources({
    notionConnector: new MockNotionConnector(),
    githubConnector: new MockGitHubConnector(),
  });
  assert.deepEqual(sources, []);
});

test('is fail-open: a failing connector is skipped with a warning, not thrown', async () => {
  const throwingNotion: NotionConnector = {
    async readPage() {
      throw new SourceError('NOT_FOUND', 'page not shared');
    },
  };
  const { sources, warnings } = await resolveExternalSources({
    notionConnector: throwingNotion,
    githubConnector: new MockGitHubConnector(),
    notionPageId: 'page-1',
    githubPrUrl: 'https://github.com/o/r/pull/1',
  });

  // GitHub still resolves; Notion is skipped with a warning.
  assert.equal(sources.length, 1);
  assert.equal(sources[0]?.source.kind, 'github');
  assert.ok(warnings.some((w) => /Notion source skipped/.test(w)));
});

test('a GitHub connector error does not break resolution', async () => {
  const throwingGitHub: GitHubConnector = {
    async readPullRequest() {
      throw new Error('network down');
    },
  };
  const { sources, warnings } = await resolveExternalSources({
    githubConnector: throwingGitHub,
    githubPrUrl: 'https://github.com/o/r/pull/1',
  });
  assert.deepEqual(sources, []);
  assert.ok(warnings.some((w) => /GitHub source skipped/.test(w)));
});
