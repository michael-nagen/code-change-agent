/**
 * Demo for the GitDiffReaderTool.
 *
 * Run with: npm run example:gitdiff
 *
 * Reads the working-tree diff of the current repository and prints the raw diff
 * length, changed files, and stats. The tool performs data access only — no
 * reasoning or summarization.
 */
import { DefaultGitDiffReaderTool } from '../src/index.js';

async function main(): Promise<void> {
  const tool = new DefaultGitDiffReaderTool();

  const result = await tool.execute();

  console.log('Tool:', tool.name);
  console.log('rawDiff length:', result.rawDiff.length);
  console.log('changedFiles:', result.changedFiles);
  console.log('stats:', result.stats);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
