import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ToolError } from '../../errors/ToolError.js';
import type { GitDiffReaderInput, GitDiffReaderTool, GitDiffResult } from './types.js';

const execFileAsync = promisify(execFile);

/**
 * Real GitDiffReaderTool: shells out to `git` to read a diff.
 *
 * It performs external data access only — it does not reason about, summarize,
 * or rank the changes. Output feeds the future ChangeUnderstandingSkill.
 */
export class DefaultGitDiffReaderTool implements GitDiffReaderTool {
  readonly name = 'git-diff-reader';

  async execute(input: GitDiffReaderInput = {}): Promise<GitDiffResult> {
    const cwd = input.cwd ?? process.cwd();
    await this.assertGitRepo(cwd);

    const range = this.buildRange(input);

    const rawDiff = await this.git({ cwd, args: ['diff', ...range] });
    const nameOnly = await this.git({ cwd, args: ['diff', '--name-only', ...range] });
    const numstat = await this.git({ cwd, args: ['diff', '--numstat', ...range] });

    const changedFiles = this.parseLines(nameOnly);
    const { additions, deletions } = this.parseNumstat(numstat);

    return {
      rawDiff,
      changedFiles,
      stats: {
        filesChanged: changedFiles.length,
        additions,
        deletions,
      },
    };
  }

  /** A ranged diff requires both refs; otherwise read the working tree. */
  private buildRange({ baseRef, targetRef }: GitDiffReaderInput): string[] {
    if (baseRef && targetRef) {
      return [`${baseRef}...${targetRef}`];
    }
    return [];
  }

  private async assertGitRepo(cwd: string): Promise<void> {
    try {
      await this.git({ cwd, args: ['rev-parse', '--is-inside-work-tree'] });
    } catch {
      throw new ToolError('NOT_A_GIT_REPO', `Not a git repository: ${cwd}`);
    }
  }

  private async git({ cwd, args }: { cwd: string; args: string[] }): Promise<string> {
    try {
      const { stdout } = await execFileAsync('git', args, {
        cwd,
        maxBuffer: 64 * 1024 * 1024,
      });
      return stdout;
    } catch (err) {
      const stderr =
        typeof err === 'object' && err !== null && 'stderr' in err
          ? String((err as { stderr: unknown }).stderr)
          : String(err);
      throw new ToolError('GIT_COMMAND_FAILED', `git ${args.join(' ')} failed: ${stderr.trim()}`);
    }
  }

  private parseLines(output: string): string[] {
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  /** Sum additions/deletions from `--numstat`. Binary files report "-". */
  private parseNumstat(output: string): { additions: number; deletions: number } {
    let additions = 0;
    let deletions = 0;

    for (const line of this.parseLines(output)) {
      const [added, removed] = line.split('\t');
      additions += this.toCount(added);
      deletions += this.toCount(removed);
    }

    return { additions, deletions };
  }

  private toCount(value: string | undefined): number {
    if (value === undefined || value === '-') {
      return 0;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
}
