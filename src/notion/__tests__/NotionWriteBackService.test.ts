import { test } from 'node:test';
import assert from 'node:assert/strict';

import { NotionWriteBackService, chunkOnLineBreaks } from '../NotionWriteBackService.js';
import { NotionWriteBackError } from '../../errors/NotionWriteBackError.js';
import { MockNotionConnector } from '../../sources/index.js';
import { MockAnalysisRunner } from '../../ui/analysisRunner.js';
import type { AnalysisResult } from '../../analysis/index.js';
import type { ProjectMemory } from '../../memory/index.js';
import { MEMORY_SCHEMA_VERSION } from '../../memory/index.js';

const NOW = '2026-07-08T09:00:00.000Z';

async function resultWith(): Promise<AnalysisResult> {
  return new MockAnalysisRunner().run({
    requirementText: 'Build the thing',
    rawDiff: '+ added line',
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

const memory: ProjectMemory = {
  schemaVersion: MEMORY_SCHEMA_VERSION,
  userId: 'local',
  projectId: 'demo',
  activeSpecSummary: 'Spec.',
  latestSnapshot: {
    date: '2026-07-07',
    dailySummary: 'Summary.',
    updatedChecklistStatuses: [],
    openBlockers: [],
    openDecisions: [],
    nextActions: [],
  },
  history: [],
  updatedAt: NOW,
};

test('missing connector fails closed with a NOT_CONFIGURED error', async () => {
  const service = new NotionWriteBackService({ defaultPageId: 'page-1' });
  assert.equal(service.isConfigured(), false);
  const result = await resultWith();
  await assert.rejects(
    () => service.write({ source: 'dailyWorkGuidance', result, now: NOW }),
    (err: unknown) => err instanceof NotionWriteBackError && err.code === 'NOT_CONFIGURED',
  );
});

test('missing target page fails with a NO_PAGE error', async () => {
  const service = new NotionWriteBackService({ connector: new MockNotionConnector() });
  const result = await resultWith();
  await assert.rejects(
    () => service.write({ source: 'dailyWorkGuidance', result, now: NOW }),
    (err: unknown) => err instanceof NotionWriteBackError && err.code === 'NO_PAGE',
  );
});

test('missing artifact fails with a MISSING_ARTIFACT error (never invents content)', async () => {
  const connector = new MockNotionConnector();
  const service = new NotionWriteBackService({ connector, defaultPageId: 'page-1' });
  // A result with no weekly review present.
  const result = await new MockAnalysisRunner().run({
    requirementText: 'x',
    rawDiff: '+y',
    includeFlow: true,
    includeGapReport: true,
    includePrDescription: false,
    includeVideoScript: false,
    includeDailyUpdate: false,
    includeDailyWorkGuidance: false,
    includeTechnicalChangeBrief: false,
    includeDemoPrepLoop: false,
    includeWeeklyReview: false,
  });
  await assert.rejects(
    () => service.write({ source: 'weeklyReview', result, now: NOW }),
    (err: unknown) => err instanceof NotionWriteBackError && err.code === 'MISSING_ARTIFACT',
  );
  assert.equal(connector.appended.length, 0);
});

test('a successful write appends to the connector with the resolved page and title', async () => {
  const connector = new MockNotionConnector();
  const service = new NotionWriteBackService({ connector, defaultPageId: 'default-page' });
  const result = await resultWith();
  const written = await service.write({ source: 'dailyWorkGuidance', result, now: NOW });
  assert.match(written.title, /^Daily Work Guidance —/);
  assert.ok(connector.appended.length >= 1);
  for (const call of connector.appended) {
    assert.equal(call.pageIdOrUrl, 'default-page');
  }
  assert.ok(connector.appended[0]!.content.includes('Daily Work Guidance —'));
});

test('an explicit pageIdOrUrl overrides the configured default', async () => {
  const connector = new MockNotionConnector();
  const service = new NotionWriteBackService({ connector, defaultPageId: 'default-page' });
  const result = await resultWith();
  await service.write({ source: 'weeklyReview', result, pageIdOrUrl: 'override-page', now: NOW });
  assert.ok(connector.appended.every((c) => c.pageIdOrUrl === 'override-page'));
});

test('memory snapshot writes from project memory (no session artifact needed)', async () => {
  const connector = new MockNotionConnector();
  const service = new NotionWriteBackService({ connector, defaultPageId: 'page-1' });
  const written = await service.write({ source: 'projectMemory', projectMemory: memory, now: NOW });
  assert.match(written.title, /^Project Memory Snapshot —/);
  assert.ok(connector.appended.length >= 1);
});

test('long content is split into multiple appended chunks under the size cap', () => {
  const line = 'x'.repeat(100);
  const text = Array.from({ length: 60 }, () => line).join('\n');
  const chunks = chunkOnLineBreaks(text, 1800);
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) assert.ok(chunk.length <= 1800);
});

test('error messages never contain a Notion secret', async () => {
  const service = new NotionWriteBackService({ defaultPageId: 'page-1' });
  const result = await resultWith();
  const err = await service
    .write({ source: 'dailyWorkGuidance', result, now: NOW })
    .then(() => undefined)
    .catch((e: unknown) => e);
  assert.ok(err instanceof NotionWriteBackError);
  assert.ok(!/secret_/.test((err as Error).message));
});
