/**
 * Plain-text/markdown formatters for copyable artifacts.
 *
 * These turn a structured artifact into a clean, ready-to-paste document. They
 * are separate from the HTML body views so copy formatting never gets tangled
 * up with layout markup.
 */
import type { PRDescription } from '../../../../skills/prDescription/index.js';

/** Assemble the PR description as a single copyable markdown document. */
export function prDescriptionToMarkdown(pr: PRDescription): string {
  const lines: string[] = [];
  lines.push(`# ${pr.title}`, '', pr.summary, '');
  lines.push('## What changed');
  for (const item of pr.whatChanged) lines.push(`- ${item}`);
  lines.push('', '## Requirement coverage');
  for (const item of pr.requirementCoverage) lines.push(`- ${item}`);
  lines.push('', '## Feature flow', '', pr.featureFlow, '');
  lines.push('## Testing notes');
  for (const item of pr.testingNotes) lines.push(`- ${item}`);
  lines.push('', '## Risks and follow-ups');
  for (const item of pr.risksAndFollowUps) lines.push(`- ${item}`);
  return lines.join('\n');
}
