/**
 * Resolve configured external sources (Notion/GitHub) into normalized sources.
 *
 * Fail-open by design: a connector error (bad URL, 404, not shared, network)
 * NEVER breaks the run — the source is skipped and a human-readable warning is
 * returned. Manual flows therefore always work, even when integrations are
 * misconfigured. It resolves a source only when both a connector and an id/url
 * are present.
 */
import { SourceError } from '../errors/SourceError.js';
import type {
  GitHubConnector,
  NormalizedProjectSource,
  NotionConnector,
} from './types.js';

export async function resolveExternalSources({
  notionConnector,
  githubConnector,
  notionPageId,
  githubPrUrl,
}: {
  notionConnector?: NotionConnector;
  githubConnector?: GitHubConnector;
  notionPageId?: string;
  githubPrUrl?: string;
}): Promise<{ sources: NormalizedProjectSource[]; warnings: string[] }> {
  const sources: NormalizedProjectSource[] = [];
  const warnings: string[] = [];

  if (notionConnector !== undefined && nonEmpty(notionPageId)) {
    try {
      sources.push(await notionConnector.readPage({ pageIdOrUrl: notionPageId as string }));
    } catch (err) {
      warnings.push(`Notion source skipped: ${describe(err)}`);
    }
  }

  if (githubConnector !== undefined && nonEmpty(githubPrUrl)) {
    try {
      const pr = await githubConnector.readPullRequest({ url: githubPrUrl as string });
      sources.push({
        source: pr.source,
        text: pr.combinedDiffText,
        summary: pr.description ?? pr.title,
        metadata: {
          title: pr.title,
          changedFiles: pr.changedFiles.map((f) => f.path),
          ...(pr.commits !== undefined ? { commitCount: pr.commits.length } : {}),
        },
      });
    } catch (err) {
      warnings.push(`GitHub source skipped: ${describe(err)}`);
    }
  }

  return { sources, warnings };
}

function nonEmpty(value: string | undefined): boolean {
  return value !== undefined && value.trim() !== '';
}

function describe(err: unknown): string {
  if (err instanceof SourceError) return `${err.code}: ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}
