/**
 * Config-driven connector factory. This is the single seam where real
 * Notion/GitHub connectors are constructed from environment configuration.
 *
 * Rules (per the integration spec):
 *  - integrations are DISABLED by default;
 *  - manual flow still works when env vars are missing;
 *  - secrets are read from env, never hardcoded or logged;
 *  - if enabled but a connector's credentials are missing, that connector is
 *    skipped safely and a warning is recorded (the run is not broken).
 *
 * Env:
 *  - SOURCE_INTEGRATIONS_ENABLED = 'true' | anything-else (default disabled)
 *  - NOTION_API_KEY, NOTION_DEFAULT_PAGE_ID
 *  - GITHUB_TOKEN (optional), GITHUB_DEFAULT_PR_URL
 */
import { HttpNotionConnector } from './connectors/HttpNotionConnector.js';
import { HttpGitHubConnector } from './connectors/HttpGitHubConnector.js';
import type { GitHubConnector, NotionConnector, SourceFetch } from './types.js';

export interface ResolvedConnectors {
  enabled: boolean;
  notionConnector?: NotionConnector;
  githubConnector?: GitHubConnector;
  /** Default source ids/urls to use when a run does not pass its own. */
  defaults: { notionPageId?: string; githubPrUrl?: string };
  /** Non-fatal configuration notes (e.g. "enabled but no Notion key"). */
  warnings: string[];
}

export function resolveConnectors({
  env = process.env,
  fetchImpl,
}: {
  env?: Record<string, string | undefined>;
  fetchImpl?: SourceFetch;
} = {}): ResolvedConnectors {
  const enabled = env.SOURCE_INTEGRATIONS_ENABLED === 'true';
  if (!enabled) {
    return { enabled: false, defaults: {}, warnings: [] };
  }

  const warnings: string[] = [];
  const result: ResolvedConnectors = { enabled: true, defaults: {}, warnings };

  const notionKey = trimmed(env.NOTION_API_KEY);
  if (notionKey !== undefined) {
    result.notionConnector = new HttpNotionConnector({
      apiKey: notionKey,
      ...(fetchImpl !== undefined ? { fetchImpl } : {}),
    });
    const pageId = trimmed(env.NOTION_DEFAULT_PAGE_ID);
    if (pageId !== undefined) result.defaults.notionPageId = pageId;
  } else {
    warnings.push('Integrations enabled but NOTION_API_KEY is missing — Notion is disabled.');
  }

  // GitHub public PRs need no token; a token (when present) is used for rate limits.
  const githubToken = trimmed(env.GITHUB_TOKEN);
  result.githubConnector = new HttpGitHubConnector({
    ...(githubToken !== undefined ? { token: githubToken } : {}),
    ...(fetchImpl !== undefined ? { fetchImpl } : {}),
  });
  const prUrl = trimmed(env.GITHUB_DEFAULT_PR_URL);
  if (prUrl !== undefined) result.defaults.githubPrUrl = prUrl;

  return result;
}

function trimmed(value: string | undefined): string | undefined {
  return value !== undefined && value.trim() !== '' ? value.trim() : undefined;
}
