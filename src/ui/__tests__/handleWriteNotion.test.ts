import { test } from 'node:test';
import assert from 'node:assert/strict';

import { handleWriteNotion } from '../handleWriteNotion.js';
import { UiSessionStore } from '../sessionStore.js';
import { MockAnalysisRunner } from '../analysisRunner.js';
import { NotionWriteBackService } from '../../notion/index.js';
import { MockNotionConnector } from '../../sources/index.js';
import { InMemoryMemoryStore, MEMORY_SCHEMA_VERSION } from '../../memory/index.js';
import type { AnalysisResult } from '../../analysis/index.js';

async function seededStore(): Promise<{ store: UiSessionStore; result: AnalysisResult }> {
  const result = await new MockAnalysisRunner().run({
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
  const store = new UiSessionStore();
  store.saveResult(result);
  return { store, result };
}

function configuredService(): { service: NotionWriteBackService; connector: MockNotionConnector } {
  const connector = new MockNotionConnector();
  const service = new NotionWriteBackService({ connector, defaultPageId: 'page-1' });
  return { service, connector };
}

test('sends the daily artifact to Notion and confirms with a title', async () => {
  const { store, result } = await seededStore();
  const { service, connector } = configuredService();
  const response = await handleWriteNotion({
    notionWriteBack: service,
    store,
    memoryStore: new InMemoryMemoryStore(),
    sessionId: result.sessionId,
    body: { source: 'dailyWorkGuidance', projectName: 'demo' },
  });
  assert.equal(response.status, 'success');
  if (response.status === 'success') {
    assert.equal(response.message, 'Sent to Notion.');
    assert.match(response.title, /Daily Work Guidance/);
  }
  assert.ok(connector.appended.length >= 1);
});

test('returns a config error (and does not write) when write-back is not wired', async () => {
  const { store, result } = await seededStore();
  const response = await handleWriteNotion({
    store,
    memoryStore: new InMemoryMemoryStore(),
    sessionId: result.sessionId,
    body: { source: 'dailyWorkGuidance', projectName: 'demo' },
  });
  assert.equal(response.status, 'error');
  if (response.status === 'error') assert.match(response.message, /not configured/i);
});

test('returns a config error when the service exists but Notion is unconfigured', async () => {
  const { store, result } = await seededStore();
  const service = new NotionWriteBackService({ defaultPageId: 'page-1' }); // no connector
  const response = await handleWriteNotion({
    notionWriteBack: service,
    store,
    memoryStore: new InMemoryMemoryStore(),
    sessionId: result.sessionId,
    body: { source: 'dailyWorkGuidance', projectName: 'demo' },
  });
  assert.equal(response.status, 'error');
  if (response.status === 'error') assert.match(response.message, /NOTION_API_KEY/);
});

test('rejects an invalid source', async () => {
  const { store, result } = await seededStore();
  const { service } = configuredService();
  const response = await handleWriteNotion({
    notionWriteBack: service,
    store,
    memoryStore: new InMemoryMemoryStore(),
    sessionId: result.sessionId,
    body: { source: 'rawDiff', projectName: 'demo' },
  });
  assert.equal(response.status, 'error');
  if (response.status === 'error') assert.match(response.message, /valid Notion target/i);
});

test('unknown session returns a clear error and does not write', async () => {
  const { service, connector } = configuredService();
  const response = await handleWriteNotion({
    notionWriteBack: service,
    store: new UiSessionStore(),
    memoryStore: new InMemoryMemoryStore(),
    sessionId: 'nope',
    body: { source: 'dailyWorkGuidance', projectName: 'demo' },
  });
  assert.equal(response.status, 'error');
  if (response.status === 'error') assert.match(response.message, /Session not found/);
  assert.equal(connector.appended.length, 0);
});

test('memory snapshot requires a project name', async () => {
  const { service } = configuredService();
  const response = await handleWriteNotion({
    notionWriteBack: service,
    store: new UiSessionStore(),
    memoryStore: new InMemoryMemoryStore(),
    sessionId: 'sid',
    body: { source: 'projectMemory', projectName: '' },
  });
  assert.equal(response.status, 'error');
  if (response.status === 'error') assert.match(response.message, /project name/i);
});

test('memory snapshot errors clearly when no memory is saved yet', async () => {
  const { service } = configuredService();
  const response = await handleWriteNotion({
    notionWriteBack: service,
    store: new UiSessionStore(),
    memoryStore: new InMemoryMemoryStore(),
    sessionId: 'sid',
    body: { source: 'projectMemory', projectName: 'demo' },
  });
  assert.equal(response.status, 'error');
  if (response.status === 'error') assert.match(response.message, /No saved project memory/i);
});

test('memory snapshot sends saved project memory to Notion', async () => {
  const memoryStore = new InMemoryMemoryStore();
  await memoryStore.saveProjectMemory({
    userId: 'local',
    projectId: 'demo',
    memory: {
      schemaVersion: MEMORY_SCHEMA_VERSION,
      userId: 'local',
      projectId: 'demo',
      activeSpecSummary: 'Spec.',
      latestSnapshot: {
        date: '2026-07-07',
        dailySummary: 'Progress.',
        updatedChecklistStatuses: [],
        openBlockers: [],
        openDecisions: [],
        nextActions: [],
      },
      history: [],
      updatedAt: '2026-07-07T00:00:00.000Z',
    },
  });
  const { service, connector } = configuredService();
  const response = await handleWriteNotion({
    notionWriteBack: service,
    store: new UiSessionStore(),
    memoryStore,
    sessionId: 'sid',
    body: { source: 'projectMemory', projectName: 'demo' },
  });
  assert.equal(response.status, 'success');
  assert.ok(connector.appended.some((c) => c.content.includes('Project Memory Snapshot')));
});

test('generating and saving artifacts performs no Notion write on its own', async () => {
  // Seeding a session (the generation path) must not touch the connector; a
  // write only happens through the explicit handler call.
  const { store, result } = await seededStore();
  const { service, connector } = configuredService();
  assert.equal(connector.appended.length, 0);

  // Only an explicit handler call writes.
  await handleWriteNotion({
    notionWriteBack: service,
    store,
    memoryStore: new InMemoryMemoryStore(),
    sessionId: result.sessionId,
    body: { source: 'weeklyReview', projectName: 'demo' },
  });
  assert.equal(connector.appended.length >= 1, true);
});
