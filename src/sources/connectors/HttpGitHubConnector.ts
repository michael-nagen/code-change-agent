/**
 * A real-ready GitHub connector.
 *
 * It fetches a public PR/commit `.diff` (no auth required) and parses it into a
 * `GitHubPullRequestSource`. A token, when provided, is sent as an Authorization
 * header (helps rate limits); full private-repo support would use the GitHub API
 * and is intentionally out of scope for this MVP (see docs/integrations-setup.md).
 *
 * Network access is injected so tests never hit real GitHub. No secrets logged.
 */
import { SourceError } from '../../errors/SourceError.js';
import type {
  GitHubConnector,
  GitHubPullRequestSource,
  SourceFetch,
} from '../types.js';
import { defaultSourceFetch } from '../types.js';

export class HttpGitHubConnector implements GitHubConnector {
  private readonly fetchImpl: SourceFetch;
  private readonly token?: string;

  constructor({ token, fetchImpl }: { token?: string; fetchImpl?: SourceFetch } = {}) {
    this.fetchImpl = fetchImpl ?? defaultSourceFetch;
    if (token !== undefined && token.trim() !== '') {
      this.token = token;
    }
  }

  async readPullRequest({ url }: { url: string }): Promise<GitHubPullRequestSource> {
    const diffUrl = toGitHubDiffUrl(url);
    const headers: Record<string, string> = { Accept: 'application/vnd.github.v3.diff' };
    if (this.token !== undefined) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    let response;
    try {
      response = await this.fetchImpl(diffUrl, { headers });
    } catch (err) {
      throw new SourceError('FETCH', `Failed to fetch GitHub diff: ${describe(err)}`);
    }
    if (!response.ok) {
      if (response.status === 404) {
        throw new SourceError(
          'NOT_FOUND',
          `GitHub returned 404 for ${url}. The PR/commit may be private or the URL wrong.`,
        );
      }
      throw new SourceError('FETCH', `GitHub request failed with status ${response.status}.`);
    }

    const combinedDiffText = (await response.text()).trim();
    if (combinedDiffText === '') {
      throw new SourceError('FETCH', `GitHub returned an empty diff for ${url}.`);
    }

    return {
      source: {
        kind: 'github',
        title: titleFromUrl(url),
        url,
        fetchedAt: new Date().toISOString(),
        confidence: 'confirmed',
      },
      title: titleFromUrl(url),
      changedFiles: parseChangedFiles(combinedDiffText),
      combinedDiffText,
    };
  }
}

/**
 * Convert a public GitHub PR/commit URL into its `.diff` URL. Throws a clear
 * error for non-github.com or unsupported URLs. (Mirrors the UI helper so the
 * connector stays self-contained.)
 */
export function toGitHubDiffUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SourceError('VALIDATION', 'Invalid GitHub URL.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new SourceError('VALIDATION', 'GitHub URL must use http or https.');
  }
  if (parsed.hostname !== 'github.com' && parsed.hostname !== 'www.github.com') {
    throw new SourceError('VALIDATION', 'Only public github.com URLs are supported.');
  }
  const path = parsed.pathname.replace(/\/+$/, '').replace(/\.(diff|patch)$/i, '');
  const isPr = /^\/[^/]+\/[^/]+\/pull\/\d+$/.test(path);
  const isCommit = /^\/[^/]+\/[^/]+\/commit\/[0-9a-fA-F]{7,40}$/.test(path);
  if (!isPr && !isCommit) {
    throw new SourceError(
      'VALIDATION',
      'Unsupported GitHub URL. Use a PR URL (…/pull/123) or a commit URL (…/commit/<sha>).',
    );
  }
  return `https://github.com${path}.diff`;
}

function titleFromUrl(url: string): string {
  try {
    const parts = new URL(url).pathname.replace(/\/+$/, '').split('/');
    // /owner/repo/pull/123  or  /owner/repo/commit/<sha>
    if (parts.length >= 5) {
      const owner = parts[1];
      const repo = parts[2];
      const kind = parts[3];
      const ref = parts[4];
      if (kind === 'pull') return `${owner}/${repo} PR #${ref}`;
      if (kind === 'commit') return `${owner}/${repo} commit ${(ref ?? '').slice(0, 8)}`;
    }
  } catch {
    // fall through
  }
  return 'GitHub change';
}

/** Split a unified diff into per-file entries with their patch text. */
export function parseChangedFiles(diff: string): Array<{ path: string; status?: string; patch?: string }> {
  const files: Array<{ path: string; status?: string; patch?: string }> = [];
  const chunks = diff.split(/^diff --git /m).filter((c) => c.trim() !== '');
  for (const chunk of chunks) {
    const header = `diff --git ${chunk}`;
    const match = header.match(/^diff --git a\/(.+?) b\/(.+?)$/m);
    const path = match?.[2] ?? match?.[1];
    if (path === undefined) continue;
    const status = /^new file mode /m.test(header)
      ? 'added'
      : /^deleted file mode /m.test(header)
        ? 'deleted'
        : 'modified';
    files.push({ path, status, patch: header.trim() });
  }
  return files;
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
