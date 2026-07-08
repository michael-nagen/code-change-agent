import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyGuidanceDecisions } from '../applyGuidanceDecisions.js';
import { mergeGuidanceRefinement } from '../mergeGuidanceRefinement.js';
import { HarnessError } from '../../errors/HarnessError.js';
import type { DailyWorkGuidance, PlannedStep } from '../../skills/dailyWorkGuidance/index.js';
import type { GuidancePlanRefinement } from '../../skills/dailyWorkGuidanceRefinement/index.js';

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
    progressVsSpec: [
      {
        item: 'Planning stage',
        whatChanged: 'Implemented.',
        newStatus: 'done',
        evidence: 'Alignment satisfied.',
        confidence: 'high',
      },
    ],
    advancedChecklistItems: [],
    blockersAndRisks: [],
    decisionsNeedingApproval: [],
    plannedSteps: [step('step-1', 'Open the PR'), step('step-2', 'Write docs')],
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
}

/** Decide (reject step-1 / approve step-2), then return the decided guidance. */
function decidedGuidance(): DailyWorkGuidance {
  return applyGuidanceDecisions({
    guidance: guidance(),
    decisions: [
      { itemId: 'step-1', action: 'reject', note: 'Tests are missing' },
      { itemId: 'step-2', action: 'approve' },
    ],
    decidedAt: DECIDED_AT,
  }).guidance;
}

function refinement(): GuidancePlanRefinement {
  return {
    revisionSummary: 'Swapped the PR step for a test-first step.',
    revisedSteps: [
      {
        respondsTo: 'step-1',
        title: 'Write the missing tests first',
        whyItMatters: 'PR was too early.',
        expectedOutput: 'Tests exist.',
        cursorPrompt: 'Write tests.',
        validationChecklist: ['Tests pass.'],
        status: 'pending_approval',
      },
    ],
    notionDailyUpdate: {
      yesterday: 'Built planning (revised prose).',
      today: 'model claim — will be recomputed',
      blockers: 'None.',
      decisionsNeeded: 'model claim — will be recomputed',
      progressVsSpec: 'Planning done; plan revised.',
      nextCursorPrompt: 'model claim — will be recomputed',
    },
    memoryUpdate: {
      date: '2099-01-01',
      dailySummary: 'Plan revised after feedback.',
      updatedChecklistStatuses: [{ item: 'Planning', status: 'done' }],
      newDecisions: ['Model-added context line'],
      openBlockers: [],
      nextActions: ['model claim — will be recomputed'],
    },
  };
}

test('a revision of a rejected step appends as pending approval; the rejection stays visible', () => {
  const merged = mergeGuidanceRefinement({
    decided: decidedGuidance(),
    refinement: refinement(),
    decidedAt: DECIDED_AT,
  });

  const ids = merged.plannedSteps.map((s) => `${s.id}:${s.status}`);
  assert.deepEqual(ids, ['step-1:rejected', 'step-2:approved', 'step-r1:pending_approval']);
  const revised = merged.plannedSteps[2];
  assert.equal(revised?.title, 'Write the missing tests first');
  assert.equal(revised?.respondsTo, 'step-1');
});

test('a revision of an edited step supersedes it in place, returning for approval', () => {
  const decided = applyGuidanceDecisions({
    guidance: guidance(),
    decisions: [{ itemId: 'step-2', action: 'edit', editedText: 'Write API docs only' }],
    decidedAt: DECIDED_AT,
  }).guidance;

  const merged = mergeGuidanceRefinement({
    decided,
    refinement: {
      ...refinement(),
      revisedSteps: [{ ...refinement().revisedSteps[0]!, respondsTo: 'step-2' }],
    },
    decidedAt: DECIDED_AT,
  });

  const ids = merged.plannedSteps.map((s) => `${s.id}:${s.status}`);
  assert.deepEqual(ids, ['step-1:pending_approval', 'step-r1:pending_approval']);
  assert.equal(merged.plannedSteps[1]?.respondsTo, 'step-2');
});

test('factual sections are preserved from the decided guidance, never the model', () => {
  const decided = decidedGuidance();
  const merged = mergeGuidanceRefinement({
    decided,
    refinement: refinement(),
    decidedAt: DECIDED_AT,
  });

  assert.equal(merged.yesterdaySummary, decided.yesterdaySummary);
  assert.deepEqual(merged.progressVsSpec, decided.progressVsSpec);
  assert.deepEqual(merged.advancedChecklistItems, decided.advancedChecklistItems);
  assert.deepEqual(merged.blockersAndRisks, decided.blockersAndRisks);
});

test('status-derived fields are recomputed from real statuses, not taken from model claims', () => {
  const merged = mergeGuidanceRefinement({
    decided: decidedGuidance(),
    refinement: refinement(),
    decidedAt: DECIDED_AT,
  });

  // step-2 is the only approved step; the revised step is pending.
  assert.equal(merged.notionDailyUpdate.today, 'Approved plan: Write docs');
  assert.equal(merged.notionDailyUpdate.nextCursorPrompt, 'Prompt for Write docs.');
  assert.deepEqual(merged.memoryUpdate.nextActions, ['Write docs']);
  // The model's prose fields ARE accepted.
  assert.equal(merged.notionDailyUpdate.progressVsSpec, 'Planning done; plan revised.');
  assert.equal(merged.memoryUpdate.dailySummary, 'Plan revised after feedback.');
});

test('the durable date and decision audit trail never regress', () => {
  const decided = decidedGuidance();
  const merged = mergeGuidanceRefinement({
    decided,
    refinement: refinement(),
    decidedAt: DECIDED_AT,
  });

  assert.equal(merged.memoryUpdate.date, '2026-07-07');
  // The deterministic decision lines survive; the model's extra line appends.
  assert.ok(merged.memoryUpdate.newDecisions.some((l) => l.startsWith('Rejected: step-1')));
  assert.ok(merged.memoryUpdate.newDecisions.includes('Model-added context line'));
});

test('the loop advances to the revised stage while revisions await approval', () => {
  const decided = decidedGuidance();
  assert.equal(decided.loopStatus.currentStage, 'approved_plan');

  const merged = mergeGuidanceRefinement({
    decided,
    refinement: refinement(),
    decidedAt: DECIDED_AT,
  });

  assert.equal(merged.loopStatus.currentStage, 'revised_plan_pending_approval');
  assert.equal(merged.loopStatus.overallStatus, 'pending_user_review');
  assert.equal(merged.loopStatus.lastRevisionSummary, 'Swapped the PR step for a test-first step.');
});

test('approving the revised step afterwards advances to approved_plan and keeps the summary', () => {
  const merged = mergeGuidanceRefinement({
    decided: decidedGuidance(),
    refinement: refinement(),
    decidedAt: DECIDED_AT,
  });

  const final = applyGuidanceDecisions({
    guidance: merged,
    decisions: [{ itemId: 'step-r1', action: 'approve' }],
    decidedAt: '2026-07-07T13:00:00.000Z',
  }).guidance;

  assert.equal(final.loopStatus.currentStage, 'approved_plan');
  assert.equal(final.loopStatus.overallStatus, 'approved');
  assert.equal(final.loopStatus.lastRevisionSummary, 'Swapped the PR step for a test-first step.');
  assert.deepEqual(final.memoryUpdate.nextActions, ['Write docs', 'Write the missing tests first']);
});

test('fails closed when a revision targets a step the user did not push back on', () => {
  assert.throws(
    () =>
      mergeGuidanceRefinement({
        decided: decidedGuidance(),
        refinement: {
          ...refinement(),
          // step-2 was APPROVED — the model may not touch it.
          revisedSteps: [{ ...refinement().revisedSteps[0]!, respondsTo: 'step-2' }],
        },
        decidedAt: DECIDED_AT,
      }),
    (err: unknown) => err instanceof HarnessError && err.code === 'VALIDATION',
  );
});

test('revised ids never collide, even across refinement rounds', () => {
  const firstRound = mergeGuidanceRefinement({
    decided: decidedGuidance(),
    refinement: refinement(),
    decidedAt: DECIDED_AT,
  });
  // Reject the first revision too, then refine again.
  const secondDecided = applyGuidanceDecisions({
    guidance: firstRound,
    decisions: [{ itemId: 'step-r1', action: 'reject', note: 'Still wrong' }],
    decidedAt: DECIDED_AT,
  }).guidance;
  const secondRound = mergeGuidanceRefinement({
    decided: secondDecided,
    refinement: {
      ...refinement(),
      revisedSteps: [{ ...refinement().revisedSteps[0]!, respondsTo: 'step-r1' }],
    },
    decidedAt: DECIDED_AT,
  });

  const ids = secondRound.plannedSteps.map((s) => s.id);
  assert.deepEqual(new Set(ids).size, ids.length, `ids must be unique: ${ids.join(', ')}`);
  assert.ok(ids.includes('step-r2'));
});
