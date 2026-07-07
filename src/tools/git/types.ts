/**
 * Git tool types.
 *
 * Tools perform external data access only — these types describe the shape of
 * what the GitDiffReaderTool reads, with no reasoning or interpretation.
 */

/** Raw diff data plus basic metadata. */
export interface GitDiffResult {
  rawDiff: string;
  changedFiles: string[];
  stats: {
    filesChanged: number;
    additions: number;
    deletions: number;
  };
}

/** Optional inputs controlling which diff to read and from where. */
export interface GitDiffReaderInput {
  /** Base ref for a ranged diff (`git diff base...target`). */
  baseRef?: string;
  /** Target ref for a ranged diff. */
  targetRef?: string;
  /** Directory to run git in. Defaults to the current working directory. */
  cwd?: string;
}

/**
 * Reads a git diff from a local repository and returns raw data + metadata.
 * Implementations must not reason about, summarize, or rank the changes.
 */
export interface GitDiffReaderTool {
  readonly name: string;
  execute(input?: GitDiffReaderInput): Promise<GitDiffResult>;
}

/** Input accepted by the GitInputAdapter. */
export interface GitInputAdapterInput {
  repoPath: string;
  baseRef?: string;
  headRef?: string;
  requirementText: string;
}

/**
 * Normalized analysis input acquired from a git repository.
 *
 * `source` is a discriminant, mirroring RequirementInput, so future input
 * adapters can extend the union without breaking consumers. `requirementText` is
 * preserved verbatim — normalization belongs to the requirement adapter/Harness.
 */
export interface GitAnalysisInput {
  rawDiff: string;
  changedFiles: string[];
  stats: unknown;
  requirementText: string;
  source: 'git';
}

/**
 * An input adapter that turns a git repository reference into normalized
 * analysis input. It wraps a GitDiffReaderTool for I/O and must not analyze,
 * summarize, interpret, or call any reasoning skill.
 */
export interface GitInputAdapter {
  readonly name: string;
  execute(input: GitInputAdapterInput): Promise<GitAnalysisInput>;
}
