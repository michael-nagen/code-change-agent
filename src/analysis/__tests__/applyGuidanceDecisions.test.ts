import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyGuidanceDecisions, decisionItemId } from '../applyGuidanceDecisions.js';
import { HarnessError } from '../../errors/HarnessError.js';
import type { DailyWorkGuidance, PlannedStep } from '../../skills/dailyWorkGuidance/index.js';

const DECIDED_AT = '2026-07-07T12:00:00.000Z';

function step(id: string, title: string): PlannedStep {
  return {
    id,
    title,
    whyItMatters: `${title} matters.`,
    expectedOutput: `${title} done.`,
    cursorPrompt: `Prompt for ${title}.`,
    validationChecklist: ['It works.'],
    status: 'pending_approval',
  };
}

function guidance(): DailyWorkGuidance {
  return {
    loopStatus: { currentStage: 'planning', overallStatus: 'pending_user_review' },
    yesterdaySummary: 'Built planning.',
    progressVsSpec: [],
    advancedChecklistItems: [],
    blockersAndRisks: [],
    decisionsNeedingApproval: [
      {
        decision: 'Use JSON file persistence',
        context: 'Simplest durable option.',
        options: ['JSON file', 'SQLite'],
        recommendedOption: 'JSON file',
        status: 'pending_approval',
      },
    ],
    plannedSteps: [step('step-1', 'Open the PR'), step('step-2', 'Add eviction'), step('step-3', 'Write docs')],
    notionDailyUpdate: {
      yesterday: 'Built planning.',
      today: 'Open PR; add eviction; write docs.',
      blockers: 'None.',
      decisionsNeeded: 'Persistence choice.',
      progressVsSpec: 'Planning done.',
      nextCursorPrompt: 'Original prompt.',
    },
    memoryUpdate: {
      date: '2026-07-07',
      dailySummary: 'Planning done.',
      updatedChecklistStatuses: [{ item: 'Planning', status: 'done' }],
      newDecisions: ['Existing open decision'],
      openBlockers: [],
      nextActions: ['Open the PR', 'Add eviction', 'Write docs'],
    },
  };
}

test('approving a pending step changes its status to approved', () => {
  const { guidance: updated } = applyGuidanceDecisions({
    guidance: guidance(),
    decisions: [{ itemId: 'step-1', action: 'approve' }],
    decidedAt: DECIDED_AT,
  });

  assert.equal(updated.plannedSteps[0]?.status, 'approved');
  assert.equal(updated.plannedSteps[1]?.status, 'pending_approval');
});

test('editing a step updates its text, marks it edited, and keeps the note', () => {
  const { guidance: updated } = applyGuidanceDecisions({
    guidance: guidance(),
    decisions: [
      { itemId: 'step-2', action: 'edit', editedText: 'Add LRU eviction with tests', note: 'Scope it tighter' },
    ],
    decidedAt: DECIDED_AT,
  });

  const edited = updated.plannedSteps[1];
  assert.equal(edited?.status, 'edited');
  assert.equal(edited?.title, 'Add LRU eviction with tests');
  assert.equal(edited?.note, 'Scope it tighter');
});

test('rejecting a step removes it from the active plan but keeps it visible as rejected', () => {
  const { guidance: updated } = applyGuidanceDecisions({
    guidance: guidance(),
    decisions: [
      { itemId: 'step-1', action: 'approve' },
      { itemId: 'step-3', action: 'reject', note: 'Docs can wait' },
    ],
    decidedAt: DECIDED_AT,
  });

  const rejected = updated.plannedSteps[2];
  assert.equal(rejected?.status, 'rejected');
  assert.equal(rejected?.note, 'Docs can wait');
  // Still present in the artifact, but out of the active plan.
  assert.equal(updated.plannedSteps.length, 3);
  assert.deepEqual(updated.memoryUpdate.nextActions, ['Open the PR']);
  assert.equal(updated.notionDailyUpdate.today.includes('Write docs'), false);
});

test('deferred items remain visible as deferred', () => {
  const { guidance: updated } = applyGuidanceDecisions({
    guidance: guidance(),
    decisions: [{ itemId: 'step-3', action: 'defer' }],
    decidedAt: DECIDED_AT,
  });

  assert.equal(updated.plannedSteps[2]?.status, 'deferred');
  assert.equal(updated.plannedSteps.length, 3);
});

test('deciding every pending item advances the loop stage (planning → approved_plan)', () => {
  const before = guidance();
  assert.equal(before.loopStatus.currentStage, 'planning');
  assert.equal(before.loopStatus.overallStatus, 'pending_user_review');

  const { guidance: updated } = applyGuidanceDecisions({
    guidance: before,
    decisions: [
      { itemId: 'step-1', action: 'approve' },
      { itemId: 'step-2', action: 'edit', editedText: 'Add LRU eviction' },
      { itemId: 'step-3', action: 'reject' },
      { itemId: decisionItemId(0), action: 'approve' },
    ],
    decidedAt: DECIDED_AT,
  });

  assert.equal(updated.loopStatus.currentStage, 'approved_plan');
  assert.equal(updated.loopStatus.overallStatus, 'approved');
  assert.equal(updated.loopStatus.decidedAt, DECIDED_AT);
});

test('the stage stays planning while any item is still pending', () => {
  const { guidance: updated } = applyGuidanceDecisions({
    guidance: guidance(),
    decisions: [{ itemId: 'step-1', action: 'approve' }],
    decidedAt: DECIDED_AT,
  });

  // step-2, step-3 and the open decision are still pending.
  assert.equal(updated.loopStatus.currentStage, 'planning');
  assert.equal(updated.loopStatus.overallStatus, 'pending_user_review');
  assert.equal(updated.loopStatus.decidedAt, DECIDED_AT);
});

test('deferring counts as a decision — it does not block the stage advance', () => {
  const { guidance: updated } = applyGuidanceDecisions({
    guidance: guidance(),
    decisions: [
      { itemId: 'step-1', action: 'approve' },
      { itemId: 'step-2', action: 'defer' },
      { itemId: 'step-3', action: 'defer' },
      { itemId: decisionItemId(0), action: 'defer' },
    ],
    decidedAt: DECIDED_AT,
  });

  assert.equal(updated.loopStatus.currentStage, 'approved_plan');
});

test('the memory update reflects the decisions', () => {
  const { guidance: updated } = applyGuidanceDecisions({
    guidance: guidance(),
    decisions: [
      { itemId: 'step-1', action: 'approve' },
      { itemId: 'step-2', action: 'edit', editedText: 'Add LRU eviction' },
      { itemId: 'step-3', action: 'reject', note: 'Docs can wait' },
    ],
    decidedAt: DECIDED_AT,
  });

  // Active plan = approved + edited steps, in plan order.
  assert.deepEqual(updated.memoryUpdate.nextActions, ['Open the PR', 'Add LRU eviction']);
  // Existing decisions are kept; one durable line per decided item is added.
  assert.equal(updated.memoryUpdate.newDecisions[0], 'Existing open decision');
  assert.ok(updated.memoryUpdate.newDecisions.includes('Approved: step-1: Open the PR'));
  assert.ok(updated.memoryUpdate.newDecisions.includes('Edited: step-2: Add LRU eviction'));
  assert.ok(updated.memoryUpdate.newDecisions.includes('Rejected: step-3: Write docs — Docs can wait'));
});

test('the Notion daily update reflects the approved plan', () => {
  const { guidance: updated } = applyGuidanceDecisions({
    guidance: guidance(),
    decisions: [
      { itemId: 'step-2', action: 'approve' },
      { itemId: 'step-1', action: 'reject' },
    ],
    decidedAt: DECIDED_AT,
  });

  assert.equal(updated.notionDailyUpdate.today, 'Approved plan: Add eviction');
  // Next prompt follows the first step of the active plan.
  assert.equal(updated.notionDailyUpdate.nextCursorPrompt, 'Prompt for Add eviction.');
  // The open decision is still pending, so it stays listed.
  assert.match(updated.notionDailyUpdate.decisionsNeeded, /JSON file persistence/);
});

test('resolving the open decision clears it from decisionsNeeded', () => {
  const { guidance: updated } = applyGuidanceDecisions({
    guidance: guidance(),
    decisions: [{ itemId: decisionItemId(0), action: 'approve', note: 'JSON file it is' }],
    decidedAt: DECIDED_AT,
  });

  assert.equal(updated.decisionsNeedingApproval[0]?.status, 'approved');
  assert.equal(updated.decisionsNeedingApproval[0]?.note, 'JSON file it is');
  assert.equal(updated.notionDailyUpdate.decisionsNeeded, 'None — all surfaced decisions are resolved.');
});

test('rejecting every step leaves an explicit empty active plan', () => {
  const { guidance: updated } = applyGuidanceDecisions({
    guidance: guidance(),
    decisions: [
      { itemId: 'step-1', action: 'reject' },
      { itemId: 'step-2', action: 'reject' },
      { itemId: 'step-3', action: 'reject' },
    ],
    decidedAt: DECIDED_AT,
  });

  assert.equal(updated.notionDailyUpdate.today, 'No steps approved yet.');
  assert.deepEqual(updated.memoryUpdate.nextActions, []);
  // The original next prompt is kept — there is no approved step to point at.
  assert.equal(updated.notionDailyUpdate.nextCursorPrompt, 'Original prompt.');
});

test('is pure — the input guidance is not mutated', () => {
  const before = guidance();
  const snapshot = structuredClone(before);

  applyGuidanceDecisions({
    guidance: before,
    decisions: [{ itemId: 'step-1', action: 'approve' }],
    decidedAt: DECIDED_AT,
  });

  assert.deepEqual(before, snapshot);
});

test('fails closed on an unknown item id', () => {
  assert.throws(
    () =>
      applyGuidanceDecisions({
        guidance: guidance(),
        decisions: [{ itemId: 'step-99', action: 'approve' }],
        decidedAt: DECIDED_AT,
      }),
    (err: unknown) => err instanceof HarnessError && err.code === 'VALIDATION',
  );
});

test('fails closed when an edit has no edited text', () => {
  assert.throws(
    () =>
      applyGuidanceDecisions({
        guidance: guidance(),
        decisions: [{ itemId: 'step-1', action: 'edit' }],
        decidedAt: DECIDED_AT,
      }),
    (err: unknown) => err instanceof HarnessError && err.code === 'VALIDATION',
  );
});

test('fails closed on an empty decision list', () => {
  assert.throws(
    () => applyGuidanceDecisions({ guidance: guidance(), decisions: [], decidedAt: DECIDED_AT }),
    (err: unknown) => err instanceof HarnessError && err.code === 'VALIDATION',
  );
});
