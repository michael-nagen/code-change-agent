import { test } from 'node:test';
import assert from 'node:assert/strict';

import { handleSaveMemory } from '../handleSaveMemory.js';
import { UiSessionStore } from '../sessionStore.js';
import { InMemoryMemoryStore } from '../../memory/index.js';
import type { AnalysisResult } from '../../analysis/index.js';
import type { DailyWorkGuidance } from '../../skills/dailyWorkGuidance/index.js';

const GUIDANCE: DailyWorkGuidance = {
  loopStatus: { currentStage: 'planning', overallStatus: 'pending_user_review' },
  yesterdaySummary: 'Built planning.',
  progressVsSpec: [],
  advancedChecklistItems: [],
  blockersAndRisks: [],
  decisionsNeedingApproval: [],
  plannedSteps: [],
  notionDailyUpdate: {
    yesterday: 'Built planning.',
    today: 'Open PR.',
    blockers: 'None.',
    decisionsNeeded: 'None.',
    progressVsSpec: 'Planning done.',
    nextCursorPrompt: 'Draft a PR.',
  },
  memoryUpdate: {
    date: '2026-07-07',
    dailySummary: 'Planning done.',
    updatedChecklistStatuses: [{ item: 'Planning', status: 'done' }],
    newDecisions: [],
    openBlockers: [],
    nextActions: ['Open PR'],
  },
};

function resultWithGuidance(sessionId: string): AnalysisResult {
  return {
    sessionId,
    requirementInput: { requirementText: 'Add planning', source: 'manual' },
    changeExplanation: {
      changeStory: 'Adds planning.',
      keyFunctionalities: ['Planning'],
      flow: ['a'],
      mainComponents: [{ name: 'Planner', responsibility: 'Plans' }],
      architecturalDecisions: [],
      impactAnalysis: [],
      uncertainties: [],
    },
    requirementAlignment: {
      requirementSummary: 'Add planning',
      satisfiedItems: [],
      partiallySatisfiedItems: [],
      missingItems: [],
      unclearItems: [],
      overallAssessment: 'ok',
      confidence: 'high',
    },
    dailyWorkGuidance: GUIDANCE,
  };
}

test('persists the proposed memory update and reports success', async () => {
  const store = new UiSessionStore();
  store.saveResult(resultWithGuidance('sess-1'));
  const memoryStore = new InMemoryMemoryStore();

  const response = await handleSaveMemory({
    memoryStore,
    store,
    sessionId: 'sess-1',
    body: { projectName: 'Checkout Service' },
  });

  assert.equal(response.status, 'success');
  const saved = await memoryStore.getProjectMemory({ userId: 'local', projectId: 'checkout-service' });
  assert.ok(saved?.latestSnapshot);
  assert.equal(saved.latestSnapshot.dailySummary, 'Planning done.');
});

test('persists the Weekly Review memory proposal when source is weeklyReview', async () => {
  const store = new UiSessionStore();
  const result = resultWithGuidance('sess-wr');
  result.weeklyReview = {
    status: {
      status: 'draft',
      confidence: 'medium',
      missingInputs: [],
      reviewPeriodLabel: 'Week ending 2026-07-07',
      generatedAt: '2026-07-07T09:00:00.000Z',
    },
    executiveSummary: 'Shipped planning.',
    progressAgainstSpec: [],
    whatChangedTechnically: {
      schemaOrDataChanges: [],
      modelOrTypeChanges: [],
      workflowOrRuntimeChanges: [],
      uiChanges: [],
      toolsOrSkillsAdded: [],
      importantFilesOrModules: [],
    },
    keyDecisions: [],
    blockersAndRisks: [],
    demoVideoStory: {
      strongestStory: 'Planning first.',
      whatToShow: [],
      whatToSay: [],
      whatToSkip: [],
      recommendedStructure: [],
      keyFilesOrScreens: [],
      strongestProductSentence: 'Planning first.',
    },
    reviewTalkingPoints: [],
    suggestedWeeklyUpdate: {
      thisWeek: 'Planning.',
      technicalProgress: 'Planner.',
      demoProductProgress: 'Demo.',
      blockers: 'None.',
      nextWeek: 'PR.',
    },
    nextWeekPlan: ['Open PR'],
    memoryUpdateProposal: {
      latestWeeklySummary: 'Weekly: planning done.',
      updatedChecklistStatuses: [{ item: 'Planning', status: 'done' }],
      newDecisions: [],
      updatedBlockers: [],
      nextActions: ['Open PR'],
      demoStorySummary: 'Planning first.',
      filesWorthShowing: [],
    },
  };
  store.saveResult(result);
  const memoryStore = new InMemoryMemoryStore();

  const response = await handleSaveMemory({
    memoryStore,
    store,
    sessionId: 'sess-wr',
    body: { projectName: 'Checkout Service', source: 'weeklyReview' },
  });

  assert.equal(response.status, 'success');
  const saved = await memoryStore.getProjectMemory({ userId: 'local', projectId: 'checkout-service' });
  assert.ok(saved?.latestSnapshot);
  assert.equal(saved.latestSnapshot.dailySummary, 'Weekly: planning done.');
});

test('reports a clear error when the Weekly Review has not been generated', async () => {
  const store = new UiSessionStore();
  store.saveResult(resultWithGuidance('sess-3')); // has dailyWorkGuidance, no weeklyReview
  const memoryStore = new InMemoryMemoryStore();

  const response = await handleSaveMemory({
    memoryStore,
    store,
    sessionId: 'sess-3',
    body: { projectName: 'Checkout', source: 'weeklyReview' },
  });

  assert.equal(response.status, 'error');
  assert.match(response.message, /Weekly Review/);
});

test('requires a project name (memory is per project)', async () => {
  const store = new UiSessionStore();
  store.saveResult(resultWithGuidance('sess-1'));
  const memoryStore = new InMemoryMemoryStore();

  const response = await handleSaveMemory({
    memoryStore,
    store,
    sessionId: 'sess-1',
    body: { projectName: '' },
  });

  assert.equal(response.status, 'error');
  assert.match(response.message, /project name/i);
});

test('reports a clear error when Daily Work Guidance has not been generated', async () => {
  const store = new UiSessionStore();
  const noGuidance = resultWithGuidance('sess-2');
  delete noGuidance.dailyWorkGuidance;
  store.saveResult(noGuidance);
  const memoryStore = new InMemoryMemoryStore();

  const response = await handleSaveMemory({
    memoryStore,
    store,
    sessionId: 'sess-2',
    body: { projectName: 'Checkout' },
  });

  assert.equal(response.status, 'error');
  assert.match(response.message, /Daily Work Guidance/);
});

test('reports session not found for an unknown session', async () => {
  const store = new UiSessionStore();
  const memoryStore = new InMemoryMemoryStore();

  const response = await handleSaveMemory({
    memoryStore,
    store,
    sessionId: 'missing',
    body: { projectName: 'Checkout' },
  });

  assert.equal(response.status, 'error');
  assert.match(response.message, /not found/i);
});

test('never throws on a malformed body', async () => {
  const store = new UiSessionStore();
  const memoryStore = new InMemoryMemoryStore();

  const response = await handleSaveMemory({ memoryStore, store, sessionId: 's', body: null });
  assert.equal(response.status, 'error');
});
