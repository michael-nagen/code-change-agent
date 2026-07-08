import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MockAnalysisRunner } from '../analysisRunner.js';
import type { AnalysisRequest } from '../types.js';

const BASE_REQUEST: AnalysisRequest = {
  rawDiff: 'diff --git a/x b/x',
  requirementText: 'Add a feature',
  includeFlow: false,
  includeGapReport: false,
  includePrDescription: false,
  includeVideoScript: false,
  includeDailyUpdate: false,
  includeDailyWorkGuidance: false,
  includeTechnicalChangeBrief: false,
  includeDemoPrepLoop: false,
  includeWeeklyReview: false,
};

test('mock GitHub/Notion sources are clearly labelled as sample data that was not fetched', async () => {
  const result = await new MockAnalysisRunner().run(BASE_REQUEST);

  const external = (result.projectContext?.sources ?? []).filter(
    (s) => s.source.kind === 'github' || s.source.kind === 'notion',
  );
  assert.equal(external.length, 2, 'expected a sample GitHub and Notion source in mock mode');

  for (const source of external) {
    const blob = `${source.source.title ?? ''} ${source.summary ?? ''} ${source.text}`;
    // Never imply a real fetch happened.
    assert.match(blob, /not (actually )?fetched/i);
    // Explicitly marked as sample/mock data.
    assert.match(blob, /sample|mock|demo/i);
  }
});
