import { DefaultGitDiffReaderTool } from './GitDiffReaderTool.js';
import type {
  GitAnalysisInput,
  GitDiffReaderTool,
  GitInputAdapter,
  GitInputAdapterInput,
} from './types.js';

/**
 * Turns a git repository reference into normalized analysis input.
 *
 * It is an input adapter only: it delegates all git I/O to the GitDiffReaderTool
 * and reshapes the result. It performs no reasoning — no analysis, no prompts,
 * no LLM parsing, no judgement about whether the change is good or complete.
 * `requirementText` is passed through untouched; normalization happens later in
 * the requirement adapter / Harness.
 */
export class DefaultGitInputAdapter implements GitInputAdapter {
  readonly name = 'git-input';

  private readonly gitDiffReader: GitDiffReaderTool;

  constructor({ gitDiffReader }: { gitDiffReader?: GitDiffReaderTool } = {}) {
    this.gitDiffReader = gitDiffReader ?? new DefaultGitDiffReaderTool();
  }

  async execute({
    repoPath,
    baseRef,
    headRef,
    requirementText,
  }: GitInputAdapterInput): Promise<GitAnalysisInput> {
    const { rawDiff, changedFiles, stats } = await this.gitDiffReader.execute({
      cwd: repoPath,
      ...(baseRef !== undefined ? { baseRef } : {}),
      ...(headRef !== undefined ? { targetRef: headRef } : {}),
    });

    return { rawDiff, changedFiles, stats, requirementText, source: 'git' };
  }
}
