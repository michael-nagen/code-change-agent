import { test } from 'node:test';
import assert from 'node:assert/strict';

import { handleApplyDecisions } from '../handleApplyDecisions.js';
import { UiSessionStore } from '../sessionStore.js';
import { InMemoryMemoryStore } from '../../memory/index.js';
import { SkillError } from '../../errors/SkillError.js';
import type { AnalysisResult } from '../../analysis/index.js';
import type { DailyWorkGuidance } from '../../skills/dailyWorkGuidance/index.js';
import type {
  GuidancePlanRefinement,
  GuidanceRefinementInput,
  GuidanceRefinementSkill,
} from '../../skills/dailyWorkGuidanceRefinement/index.js';

const GUIDANCE: DailyWorkGuidance = {
  headline: 'Planning built; next steps queued.',
  whatChanged: ['Built the planning stage.'],
  nextActions: ['Open the PR.'],
  blockersOrDecisions: [],
  loopStatus: { currentStage: 'planning', overallStatus: 'pending_user_review' },
  yesterdaySummary: 'Built planning.',
  progressVsSpec: [],
  advancedChecklistItems: [],
  blockersAndRisks: [],
  decisionsNeedingApproval: [],
  plannedSteps: [
    {
      id: 'step-1',
      title: 'Open the PR',
      whyItMatters: 'Ready to review.',
      expectedOutput: 'PR opened.',
      cursorPrompt: 'Draft a PR.',
      validationChecklist: ['CI passes.'],
      status: 'pending_approval',
    },
    {
      id: 'step-2',
      title: 'Write docs',
      whyItMatters: 'Onboarding.',
      expectedOutput: 'Docs written.',
      cursorPrompt: 'Draft docs.',
      validationChecklist: ['Docs render.'],
      status: 'pending_approval',
    },
  ],
  notionDailyUpdate: {
    yesterday: 'Built planning.',
    today: 'Open PR; write docs.',
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
    nextActions: ['Open the PR', 'Write docs'],
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
    dailyWorkGuidance: structuredClone(GUIDANCE),
  };
}

test('applies decisions, updates the stored artifact, and advances the loop', async () => {
  const store = new UiSessionStore();
  store.saveResult(resultWithGuidance('sess-1'));
  const memoryStore = new InMemoryMemoryStore();

  const response = await handleApplyDecisions({
    memoryStore,
    store,
    sessionId: 'sess-1',
    body: {
      projectName: 'Checkout Service',
      decisions: [
        { itemId: 'step-1', action: 'approve' },
        { itemId: 'step-2', action: 'edit', editedText: 'Write API docs only' },
      ],
    },
  });

  assert.equal(response.status, 'success');
  if (response.status !== 'success') return;
  // The loop visibly advanced: every pending item was decided.
  assert.deepEqual(response.loopStatus, { currentStage: 'approved_plan', overallStatus: 'approved' });
  // The session's stored artifact was updated, not just the response.
  const stored = store.getResult('sess-1');
  assert.equal(stored?.dailyWorkGuidance?.plannedSteps![0]?.status, 'approved');
  assert.equal(stored?.dailyWorkGuidance?.plannedSteps![1]?.status, 'edited');
  assert.equal(stored?.dailyWorkGuidance?.plannedSteps![1]?.title, 'Write API docs only');
  assert.equal(stored?.dailyWorkGuidance?.loopStatus!.currentStage, 'approved_plan');
  // The card re-renders as the lean checkpoint; per-item statuses live on the
  // stored artifact (asserted above), not in the card HTML.
  assert.match(response.card.html, /Where things stand/);
});

test('persists the decided plan into project memory (decisions + loop stage)', async () => {
  const store = new UiSessionStore();
  store.saveResult(resultWithGuidance('sess-2'));
  const memoryStore = new InMemoryMemoryStore();

  const response = await handleApplyDecisions({
    memoryStore,
    store,
    sessionId: 'sess-2',
    body: {
      projectName: 'Checkout Service',
      decisions: [
        { itemId: 'step-1', action: 'approve' },
        { itemId: 'step-2', action: 'reject', note: 'Not this week' },
      ],
    },
  });

  assert.equal(response.status, 'success');
  if (response.status !== 'success') return;
  assert.ok(response.memory, 'response should carry the refreshed memory status');

  const saved = await memoryStore.getProjectMemory({ userId: 'local', projectId: 'checkout-service' });
  assert.ok(saved?.latestSnapshot);
  assert.equal(saved.latestSnapshot.loopStage, 'approved_plan');
  assert.deepEqual(saved.latestSnapshot.nextActions, ['Open the PR']);
  assert.deepEqual(saved.latestSnapshot.planDecisions, [
    { itemId: 'step-1', action: 'approve', text: 'Open the PR' },
    { itemId: 'step-2', action: 'reject', text: 'Write docs', note: 'Not this week' },
  ]);
});

test('without a project name the decisions still apply but nothing is persisted', async () => {
  const store = new UiSessionStore();
  store.saveResult(resultWithGuidance('sess-3'));
  const memoryStore = new InMemoryMemoryStore();

  const response = await handleApplyDecisions({
    memoryStore,
    store,
    sessionId: 'sess-3',
    body: { decisions: [{ itemId: 'step-1', action: 'approve' }] },
  });

  assert.equal(response.status, 'success');
  if (response.status !== 'success') return;
  assert.equal(response.memory, undefined);
  assert.match(response.message, /Set a project name/);
  assert.equal(store.getResult('sess-3')?.dailyWorkGuidance?.plannedSteps![0]?.status, 'approved');
});

test('an unknown item id is reported as an error and nothing changes', async () => {
  const store = new UiSessionStore();
  store.saveResult(resultWithGuidance('sess-4'));

  const response = await handleApplyDecisions({
    memoryStore: new InMemoryMemoryStore(),
    store,
    sessionId: 'sess-4',
    body: { decisions: [{ itemId: 'step-99', action: 'approve' }] },
  });

  assert.equal(response.status, 'error');
  assert.match(response.status === 'error' ? response.message : '', /step-99/);
  assert.equal(store.getResult('sess-4')?.dailyWorkGuidance?.plannedSteps![0]?.status, 'pending_approval');
});

test('reports a clear error when Daily Work Guidance has not been generated', async () => {
  const store = new UiSessionStore();
  const result = resultWithGuidance('sess-5');
  delete result.dailyWorkGuidance;
  store.saveResult(result);

  const response = await handleApplyDecisions({
    memoryStore: new InMemoryMemoryStore(),
    store,
    sessionId: 'sess-5',
    body: { decisions: [{ itemId: 'step-1', action: 'approve' }] },
  });

  assert.equal(response.status, 'error');
  assert.match(response.status === 'error' ? response.message : '', /Generate Daily Work Guidance first/);
});

test('reports session not found for an unknown session', async () => {
  const response = await handleApplyDecisions({
    memoryStore: new InMemoryMemoryStore(),
    store: new UiSessionStore(),
    sessionId: 'nope',
    body: { decisions: [{ itemId: 'step-1', action: 'approve' }] },
  });

  assert.equal(response.status, 'error');
  assert.match(response.status === 'error' ? response.message : '', /Session not found/);
});

/** A refinement spy returning one canned revised step per reject/edit. */
function makeRefinementSpy(): {
  skill: GuidanceRefinementSkill;
  calls: () => number;
  lastInput: () => GuidanceRefinementInput | undefined;
} {
  let count = 0;
  let last: GuidanceRefinementInput | undefined;
  const skill: GuidanceRefinementSkill = {
    name: 'spy-guidance-refinement',
    async execute(input: GuidanceRefinementInput): Promise<GuidancePlanRefinement> {
      count += 1;
      last = input;
      const feedback = input.decisions.filter(
        (d) => d.action === 'reject' || d.action === 'edit',
      );
      return {
        revisionSummary: 'Reworked the plan from your feedback.',
        revisedSteps: feedback.map((d) => ({
          respondsTo: d.itemId,
          title: `Revised for ${d.itemId}`,
          whyItMatters: 'Addresses the stated reason.',
          expectedOutput: 'Revised output.',
          cursorPrompt: 'Revised prompt.',
          validationChecklist: ['Revised validation.'],
          status: 'pending_approval' as const,
        })),
        notionDailyUpdate: { ...input.guidance.notionDailyUpdate },
        memoryUpdate: { ...input.guidance.memoryUpdate },
      };
    },
  };
  return { skill, calls: () => count, lastInput: () => last };
}

test('approve/defer-only decisions stay on the deterministic path (no model call)', async () => {
  const store = new UiSessionStore();
  store.saveResult(resultWithGuidance('sess-det'));
  const spy = makeRefinementSpy();

  const response = await handleApplyDecisions({
    memoryStore: new InMemoryMemoryStore(),
    store,
    sessionId: 'sess-det',
    body: {
      decisions: [
        { itemId: 'step-1', action: 'approve' },
        { itemId: 'step-2', action: 'defer' },
      ],
    },
    refinementSkill: spy.skill,
  });

  assert.equal(response.status, 'success');
  assert.equal(spy.calls(), 0);
  assert.deepEqual(
    response.status === 'success' ? response.loopStatus : undefined,
    { currentStage: 'approved_plan', overallStatus: 'approved' },
  );
});

test('reject/edit decisions trigger the model re-plan; revised steps return pending', async () => {
  const store = new UiSessionStore();
  store.saveResult(resultWithGuidance('sess-ref'));
  const spy = makeRefinementSpy();

  const response = await handleApplyDecisions({
    memoryStore: new InMemoryMemoryStore(),
    store,
    sessionId: 'sess-ref',
    body: {
      decisions: [
        { itemId: 'step-1', action: 'approve' },
        { itemId: 'step-2', action: 'reject', note: 'Docs are premature' },
      ],
    },
    refinementSkill: spy.skill,
  });

  assert.equal(response.status, 'success');
  if (response.status !== 'success') return;
  assert.equal(spy.calls(), 1);
  // The system observed the feedback: the note reached the model.
  assert.equal(spy.lastInput()?.decisions[1]?.note, 'Docs are premature');
  // The loop advanced to the refinement stage, not straight to approved.
  assert.deepEqual(response.loopStatus, {
    currentStage: 'revised_plan_pending_approval',
    overallStatus: 'pending_user_review',
  });
  assert.equal(response.revisionSummary, 'Reworked the plan from your feedback.');

  const stored = store.getResult('sess-ref')?.dailyWorkGuidance;
  assert.ok(stored);
  const revised = stored.plannedSteps!.find((s) => s.respondsTo === 'step-2');
  assert.ok(revised, 'a revised step must exist');
  assert.equal(revised.status, 'pending_approval');
  // Factual sections were not rewritten.
  assert.equal(stored.yesterdaySummary, GUIDANCE.yesterdaySummary);
  assert.deepEqual(stored.progressVsSpec, GUIDANCE.progressVsSpec);
  // The card re-renders as the lean checkpoint; the revised stage and pending
  // revision live on the response loopStatus and the stored artifact (above).
  assert.match(response.card.html, /Where things stand/);
});

test('the full refinement loop: reject → revise → approve revised → memory persists approved_plan', async () => {
  const store = new UiSessionStore();
  store.saveResult(resultWithGuidance('sess-loop'));
  const memoryStore = new InMemoryMemoryStore();
  const spy = makeRefinementSpy();

  const first = await handleApplyDecisions({
    memoryStore,
    store,
    sessionId: 'sess-loop',
    body: {
      projectName: 'Loop Project',
      decisions: [
        { itemId: 'step-1', action: 'approve' },
        { itemId: 'step-2', action: 'reject', note: 'Wrong priority' },
      ],
    },
    refinementSkill: spy.skill,
  });
  assert.equal(first.status, 'success');
  if (first.status !== 'success') return;
  assert.equal(first.loopStatus.currentStage, 'revised_plan_pending_approval');

  // The intermediate revised stage is already persisted...
  const mid = await memoryStore.getProjectMemory({ userId: 'local', projectId: 'loop-project' });
  assert.equal(mid?.latestSnapshot?.loopStage, 'revised_plan_pending_approval');

  // ...then the user approves the revised step.
  const revisedId = store
    .getResult('sess-loop')
    ?.dailyWorkGuidance?.plannedSteps!.find((s) => s.respondsTo === 'step-2')?.id;
  assert.ok(revisedId);
  const second = await handleApplyDecisions({
    memoryStore,
    store,
    sessionId: 'sess-loop',
    body: { projectName: 'Loop Project', decisions: [{ itemId: revisedId, action: 'approve' }] },
    refinementSkill: spy.skill,
  });
  assert.equal(second.status, 'success');
  if (second.status !== 'success') return;
  assert.equal(spy.calls(), 1, 'approving the revision must not re-invoke the model');
  assert.deepEqual(second.loopStatus, { currentStage: 'approved_plan', overallStatus: 'approved' });

  // The final approved state is what memory carries into the next run.
  const saved = await memoryStore.getProjectMemory({ userId: 'local', projectId: 'loop-project' });
  assert.equal(saved?.latestSnapshot?.loopStage, 'approved_plan');
  assert.ok(saved?.latestSnapshot?.nextActions.includes('Revised for step-2'));
});

test('invalid model output keeps the safe deterministic result and reports the failure', async () => {
  const store = new UiSessionStore();
  store.saveResult(resultWithGuidance('sess-fail'));
  const failing: GuidanceRefinementSkill = {
    name: 'failing-refinement',
    async execute() {
      throw new SkillError('INVALID_OUTPUT', 'Model output is not valid JSON.');
    },
  };

  const response = await handleApplyDecisions({
    memoryStore: new InMemoryMemoryStore(),
    store,
    sessionId: 'sess-fail',
    body: { decisions: [{ itemId: 'step-2', action: 'reject', note: 'Nope' }] },
    refinementSkill: failing,
  });

  assert.equal(response.status, 'success');
  if (response.status !== 'success') return;
  assert.match(response.message, /refinement failed and was skipped/);
  const stored = store.getResult('sess-fail')?.dailyWorkGuidance;
  // The deterministic rejection stands; no partial model output leaked in.
  assert.equal(stored?.plannedSteps![1]?.status, 'rejected');
  assert.equal(stored?.plannedSteps.some((s) => s.respondsTo !== undefined), false);
});

test('never throws on a malformed body', async () => {
  const store = new UiSessionStore();
  store.saveResult(resultWithGuidance('sess-6'));
  const memoryStore = new InMemoryMemoryStore();

  for (const body of [null, 'nope', {}, { decisions: [] }, { decisions: 'x' }, { decisions: [{}] }, { decisions: [{ itemId: 'step-1', action: 'explode' }] }]) {
    const response = await handleApplyDecisions({ memoryStore, store, sessionId: 'sess-6', body });
    assert.equal(response.status, 'error');
  }
});
