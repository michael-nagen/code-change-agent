import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatDailyForNotion,
  formatWeeklyForNotion,
  formatDemoForNotion,
  formatMemorySnapshotForNotion,
} from '../formatNotionWriteBack.js';
import { MockAnalysisRunner } from '../../ui/analysisRunner.js';
import type { AnalysisResult } from '../../analysis/index.js';
import type { ProjectMemory } from '../../memory/index.js';
import { MEMORY_SCHEMA_VERSION } from '../../memory/index.js';

const NOW = '2026-07-08T09:00:00.000Z';

async function fullResult(): Promise<AnalysisResult> {
  return new MockAnalysisRunner().run({
    requirementText: 'Build the thing',
    rawDiff: '+ added line',
    projectName: 'demo',
    includeFlow: true,
    includeGapReport: true,
    includePrDescription: false,
    includeVideoScript: false,
    includeDailyUpdate: false,
    includeDailyWorkGuidance: true,
    includeTechnicalChangeBrief: false,
    includeDemoPrepLoop: true,
    includeWeeklyReview: true,
  });
}

test('daily formatter emits a dated title and all Notion daily sections', async () => {
  const result = await fullResult();
  const guidance = result.dailyWorkGuidance;
  assert.notEqual(guidance, undefined);
  const { title, body } = formatDailyForNotion({ guidance: guidance!, now: NOW });
  assert.match(title, /^Daily Work Guidance — \d{4}-\d{2}-\d{2}$/);
  for (const heading of [
    'Yesterday:',
    'Today:',
    'Blockers:',
    'Decisions needed:',
    'Progress vs spec:',
    'Next Cursor/Claude prompt:',
  ]) {
    assert.ok(body.includes(heading), `missing "${heading}"`);
  }
  assert.ok(body.includes(guidance!.notionDailyUpdate.today));
});

test('weekly formatter uses the review period and the suggested weekly update', async () => {
  const result = await fullResult();
  const review = result.weeklyReview;
  assert.notEqual(review, undefined);
  const { title, body } = formatWeeklyForNotion({ review: review!, now: NOW });
  assert.ok(title.startsWith('Weekly Review — '));
  assert.ok(title.includes(review!.status.reviewPeriodLabel));
  for (const heading of [
    'This week:',
    'Technical progress:',
    'Demo / product progress:',
    'Blockers:',
    'Next week:',
  ]) {
    assert.ok(body.includes(heading), `missing "${heading}"`);
  }
  assert.ok(body.includes(review!.suggestedWeeklyUpdate.thisWeek));
});

test('demo formatter includes story, plans, pitch, and a deck note', async () => {
  const result = await fullResult();
  const demo = result.demoPrepLoop;
  assert.notEqual(demo, undefined);
  const { title, body } = formatDemoForNotion({ demo: demo!, now: NOW });
  assert.equal(title, 'Demo Prep Summary — 2026-07-08');
  assert.ok(body.includes('Demo story:'));
  assert.ok(body.includes('Walkthrough order:'));
  assert.ok(body.includes('Screenshot plan:'));
  assert.ok(body.includes('Slide plan:'));
  assert.ok(body.includes('Short pitch:'));
  assert.ok(body.includes('Deck status:'));
  assert.ok(/download the markdown\/pptx deck/i.test(body));
});

test('memory snapshot formatter renders spec, summary, and carried lists', () => {
  const memory: ProjectMemory = {
    schemaVersion: MEMORY_SCHEMA_VERSION,
    userId: 'local',
    projectId: 'demo',
    activeSpecSummary: 'Ship the connected sources feature.',
    latestSnapshot: {
      date: '2026-07-07',
      dailySummary: 'Wired Notion end to end.',
      updatedChecklistStatuses: [{ item: 'Notion read', status: 'done' }],
      openBlockers: ['Need a shared page'],
      openDecisions: ['Append vs replace'],
      nextActions: ['Add write-back UI'],
    },
    history: [],
    updatedAt: '2026-07-07T18:00:00.000Z',
  };
  const { title, body } = formatMemorySnapshotForNotion({ memory, now: NOW });
  assert.equal(title, 'Project Memory Snapshot — 2026-07-07');
  assert.ok(body.includes('Ship the connected sources feature.'));
  assert.ok(body.includes('Wired Notion end to end.'));
  assert.ok(body.includes('Notion read: done'));
  assert.ok(body.includes('- Need a shared page'));
  assert.ok(body.includes('- Append vs replace'));
  assert.ok(body.includes('- Add write-back UI'));
  assert.ok(body.includes('2026-07-07T18:00:00.000Z'));
});

test('memory snapshot formatter falls back to now when no snapshot date exists', () => {
  const memory: ProjectMemory = {
    schemaVersion: MEMORY_SCHEMA_VERSION,
    userId: 'local',
    projectId: 'demo',
    history: [],
    updatedAt: NOW,
  };
  const { title, body } = formatMemorySnapshotForNotion({ memory, now: NOW });
  assert.equal(title, 'Project Memory Snapshot — 2026-07-08');
  assert.ok(body.includes('Active spec summary:'));
  assert.ok(body.includes('None'));
});
