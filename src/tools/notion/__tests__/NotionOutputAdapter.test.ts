import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DefaultNotionOutputAdapter } from '../NotionOutputAdapter.js';
import type { NotionArtifacts } from '../types.js';
import type { ChangeExplanation } from '../../../skills/changeExplanation/index.js';
import type { GapReport } from '../../../skills/gapReport/index.js';

const CHANGE_EXPLANATION: ChangeExplanation = {
  changeStory: 'The system now supports planning before execution.',
  keyFunctionalities: ['Supports planning before execution'],
  flow: ['Input received', 'Plan built'],
  mainComponents: [{ name: 'Planner', responsibility: 'Builds a plan.' }],
  architecturalDecisions: ['Planning separated from execution'],
  impactAnalysis: ['Execution depends on planning'],
  uncertainties: ['Whether retries are handled'],
};

const GAP_REPORT: GapReport = {
  readiness: 'needs_changes',
  completedWork: ['Planning stage is present'],
  remainingGaps: ['No audit logging'],
  partialItems: ['Validation is only partial'],
  unclearItems: ['Whether concurrency is supported'],
  risks: ['Missing audit logging may break compliance'],
  recommendedNextActions: ['Add audit logging'],
  prRecommendation: 'Address gaps before opening a PR.',
};

test('formats provided artifacts into content and reports written sections', async () => {
  const adapter = new DefaultNotionOutputAdapter();
  const artifacts: NotionArtifacts = {
    changeExplanation: CHANGE_EXPLANATION,
    gapReport: GAP_REPORT,
  };

  const result = await adapter.execute({ notionPageId: 'p1', artifacts });

  assert.equal(result.source, 'notion');
  assert.deepEqual(result.destination, { pageId: 'p1' });
  assert.deepEqual(result.writtenSections, ['changeExplanation', 'gapReport']);
  assert.ok(result.content.includes('## Change Explanation'));
  assert.ok(result.content.includes('## Gap Report'));
  assert.ok(result.content.includes('The system now supports planning before execution.'));
});

test('does not invent artifacts that were not provided', async () => {
  const adapter = new DefaultNotionOutputAdapter();

  const result = await adapter.execute({ artifacts: { changeExplanation: CHANGE_EXPLANATION } });

  assert.deepEqual(result.writtenSections, ['changeExplanation']);
  assert.equal(result.content.includes('## Gap Report'), false);
  assert.equal(result.content.includes('## PR Description'), false);
});

test('includes gaps, risks, missing, partial, and unclear items honestly', async () => {
  const adapter = new DefaultNotionOutputAdapter();

  const result = await adapter.execute({ artifacts: { gapReport: GAP_REPORT } });

  assert.ok(result.content.includes('No audit logging'));
  assert.ok(result.content.includes('Validation is only partial'));
  assert.ok(result.content.includes('Whether concurrency is supported'));
  assert.ok(result.content.includes('Missing audit logging may break compliance'));
});

test('returns empty content and no sections when no artifacts are provided', async () => {
  const adapter = new DefaultNotionOutputAdapter();

  const result = await adapter.execute({ artifacts: {} });

  assert.deepEqual(result.writtenSections, []);
  assert.equal(result.content, '');
});
