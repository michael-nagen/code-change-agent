/**
 * Deterministic connector doubles for tests and safe local experiments. They
 * perform no network I/O.
 */
import type {
  GitHubConnector,
  GitHubPullRequestSource,
  NormalizedProjectSource,
  NotionConnector,
} from './types.js';

export class MockNotionConnector implements NotionConnector {
  readonly appended: { pageIdOrUrl: string; content: string }[] = [];

  constructor(private readonly text = 'Mock Notion page text.') {}

  async readPage({ pageIdOrUrl }: { pageIdOrUrl: string }): Promise<NormalizedProjectSource> {
    return {
      source: {
        kind: 'notion',
        title: 'Mock Notion page',
        id: pageIdOrUrl,
        fetchedAt: '2026-07-07T00:00:00.000Z',
        confidence: 'confirmed',
      },
      text: this.text,
    };
  }

  async appendToPage(input: { pageIdOrUrl: string; content: string }): Promise<void> {
    this.appended.push(input);
  }
}

export class MockGitHubConnector implements GitHubConnector {
  constructor(private readonly diff = 'diff --git a/x.ts b/x.ts\n+added line') {}

  async readPullRequest({ url }: { url: string }): Promise<GitHubPullRequestSource> {
    return {
      source: {
        kind: 'github',
        title: 'Mock PR',
        url,
        fetchedAt: '2026-07-07T00:00:00.000Z',
        confidence: 'confirmed',
      },
      title: 'Mock PR',
      description: 'A mock pull request.',
      changedFiles: [{ path: 'x.ts', status: 'modified', patch: this.diff }],
      combinedDiffText: this.diff,
    };
  }
}
