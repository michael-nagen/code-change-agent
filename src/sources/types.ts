/**
 * Source-aware types for the real-ready integration layer.
 *
 * The system builds ONE unified context from manual input + memory + configured
 * Notion/GitHub sources:
 *   manual input + memory + external sources
 *     → NormalizedProjectContext
 *     → analysis workflow
 *     → Daily / Technical / Demo / Weekly artifacts
 *
 * These types are storage/provider-agnostic: connectors are injected, so real
 * Notion/GitHub implementations plug in through configuration without changing
 * callers. Manual input remains the source of truth; external sources and memory
 * are supporting context.
 */

/** Where a piece of project context came from. */
export type ProjectSourceKind =
  | 'manual'
  | 'memory'
  | 'github'
  | 'notion'
  | 'daily'
  | 'weekly'
  | 'technical_brief'
  | 'demo_prep';

/** A pointer to where a source came from, for display and grounding. */
export interface SourceReference {
  kind: ProjectSourceKind;
  title?: string;
  url?: string;
  id?: string;
  /** ISO timestamp of when the source was fetched/normalized. */
  fetchedAt?: string;
  confidence?: 'confirmed' | 'inferred';
}

/** A single normalized source: a reference plus its plain text. */
export interface NormalizedProjectSource {
  source: SourceReference;
  text: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}

/**
 * The unified project context assembled behind the scenes and attached to the
 * analysis session. `requirementText`/`diffText` are the manual (source-of-truth)
 * inputs; `memoryText` is supporting; `sources` carries every normalized source
 * with its reference; `sourceSummary` is a short human-readable overview.
 */
export interface NormalizedProjectContext {
  sources: NormalizedProjectSource[];
  requirementText?: string;
  diffText?: string;
  memoryText?: string;
  sourceSummary?: string;
}

/** A pull request read from GitHub, before it is normalized into a source. */
export interface GitHubPullRequestSource {
  source: SourceReference;
  title: string;
  description?: string;
  changedFiles: Array<{
    path: string;
    status?: string;
    patch?: string;
  }>;
  commits?: Array<{
    sha: string;
    message: string;
  }>;
  combinedDiffText: string;
}

/**
 * Reads Notion pages as normalized sources. Real implementations wrap the Notion
 * API; mocks/tests provide deterministic doubles. `appendToPage` is optional —
 * write-back is only available where a connector implements it.
 */
export interface NotionConnector {
  readPage(input: { pageIdOrUrl: string }): Promise<NormalizedProjectSource>;
  appendToPage?(input: { pageIdOrUrl: string; content: string }): Promise<void>;
}

/** Reads GitHub pull requests. Real implementations wrap the GitHub API/diff. */
export interface GitHubConnector {
  readPullRequest(input: { url: string }): Promise<GitHubPullRequestSource>;
}

/** Minimal response contract; the global `fetch` `Response` satisfies it. */
export interface SourceResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

/** Injected network impl so connectors are testable and never hit real hosts in tests. */
export type SourceFetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<SourceResponse>;

/** Default network impl: the global `fetch`, wrapped to the minimal contract. */
export const defaultSourceFetch: SourceFetch = (url, init) =>
  fetch(url, init as RequestInit) as unknown as Promise<SourceResponse>;
