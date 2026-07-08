import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyGuidanceCritique, runGuidanceSelfCritique } from '../guidanceSelfCritique.js';
import { applyGuidanceDecisions, decisionItemId } from '../applyGuidanceDecisions.js';
import { SkillError } from '../../errors/SkillError.js';
import { HarnessError } from '../../errors/HarnessError.js';
import type { DailyWorkGuidance } from '../../skills/dailyWorkGuidance/index.js';
import type {
  GuidanceCritiqueInput,
  GuidanceCritiqueSkill,
  GuidancePlanCritique,
} from '../../skills/dailyWorkGuidanceCritique/index.js';
import type { RequirementAlignment } from '../../skills/requirementAlignment/index.js';
import type { GapReport } from '../../skills/gapReport/index.js';

const CHECKED_AT = '2026-07-07T12:00:00.000Z';

const REQUIREMENT_ALIGNMENT: RequirementAlignment = {
  requirementSummary: 'Add planning',
  satisfiedItems: [],
  partiallySatisfiedItems: [],
  missingItems: [],
  unclearItems: [],
  overallAssessment: 'ok',
  confidence: 'high',
};

const GAP_REPORT: GapReport = {
  readiness: 'needs_changes',
  completedWork: [],
  remainingGaps: ['No tests'],
  partialItems: [],
  unclearItems: [],
  risks: [],
  recommendedNextActions: ['Write tests first.'],
  prRecommendation: 'Hold the PR.',
};

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
    blockersAndRisks: [
      {
        title: 'Missing tests',
        description: 'No coverage.',
        whyItMatters: 'Regressions.',
        requiredAction: 'Write tests.',
      },
    ],
    decisionsNeedingApproval: [],
    plannedSteps: [
      {
        id: 'step-1',
        title: 'Open the PR',
        whyItMatters: 'Ready.',
        expectedOutput: 'PR opened.',
        cursorPrompt: 'Draft a PR.',
        validationChecklist: [],
        status: 'pending_approval',
      },
    ],
    notionDailyUpdate: {
      yesterday: 'Built planning.',
      today: 'Open PR.',
      blockers: 'Missing tests.',
      decisionsNeeded: 'None.',
      progressVsSpec: 'Planning done.',
      nextCursorPrompt: 'Draft a PR.',
    },
    memoryUpdate: {
      date: '2026-07-07',
      dailySummary: 'Planning done.',
      updatedChecklistStatuses: [{ item: 'Planning', status: 'done' }],
      newDecisions: [],
      openBlockers: ['Missing tests'],
      nextActions: ['Open the PR'],
    },
  };
}

/** A critique that fixes the blocker mismatch (PR before tests). */
function revisionCritique(): GuidancePlanCritique {
  return {
    issues: [
      {
        targetStepId: 'step-1',
        issue: 'The step ignores the missing-tests blocker.',
        severity: 'high',
        suggestion: 'Put a test-writing step first.',
      },
    ],
    revisionNeeded: true,
    summary: 'Revised to address the blocker before the PR.',
    confidence: 'high',
    revisedPlan: {
      plannedSteps: [
        {
          title: 'Write planner tests',
          whyItMatters: 'The blocker must clear first.',
          expectedOutput: 'Tests pass.',
          cursorPrompt: 'Write tests.',
          validationChecklist: ['npm test passes.'],
          status: 'pending_approval',
        },
        {
          title: 'Open the PR',
          whyItMatters: 'Ready once tests land.',
          expectedOutput: 'PR opened.',
          cursorPrompt: 'Draft a PR.',
          validationChecklist: ['CI passes.'],
          status: 'pending_approval',
        },
      ],
      notionDailyUpdate: { ...guidance().notionDailyUpdate, today: 'Tests first, then PR.' },
      memoryUpdate: {
        ...guidance().memoryUpdate,
        date: '2099-01-01', // the merge must pin this back
        nextActions: ['Write planner tests', 'Open the PR'],
      },
    },
  };
}

function critiqueSpy(result: GuidancePlanCritique | Error): {
  skill: GuidanceCritiqueSkill;
  calls: () => number;
  lastInput: () => GuidanceCritiqueInput | undefined;
} {
  let count = 0;
  let last: GuidanceCritiqueInput | undefined;
  return {
    skill: {
      name: 'spy-critique',
      async execute(input: GuidanceCritiqueInput) {
        count += 1;
        last = input;
        if (result instanceof Error) throw result;
        return structuredClone(result);
      },
    },
    calls: () => count,
    lastInput: () => last,
  };
}

test('a blocker-mismatch critique revises the plan; revised steps are pending with fresh ids', () => {
  const updated = applyGuidanceCritique({
    guidance: guidance(),
    critique: revisionCritique(),
    checkedAt: CHECKED_AT,
  });

  assert.deepEqual(
    updated.plannedSteps.map((s) => `${s.id}:${s.title}:${s.status}`),
    [
      'step-1:Write planner tests:pending_approval',
      'step-2:Open the PR:pending_approval',
    ],
  );
  assert.equal(updated.selfCritique?.revisionApplied, true);
  assert.equal(updated.selfCritique?.checkedAt, CHECKED_AT);
  assert.equal(updated.notionDailyUpdate.today, 'Tests first, then PR.');
});

test('factual sections and the loop status survive a revision untouched', () => {
  const original = guidance();
  const updated = applyGuidanceCritique({
    guidance: original,
    critique: revisionCritique(),
    checkedAt: CHECKED_AT,
  });

  assert.equal(updated.yesterdaySummary, original.yesterdaySummary);
  assert.deepEqual(updated.progressVsSpec, original.progressVsSpec);
  assert.deepEqual(updated.blockersAndRisks, original.blockersAndRisks);
  assert.deepEqual(updated.advancedChecklistItems, original.advancedChecklistItems);
  // Still an unreviewed proposal for the user.
  assert.deepEqual(updated.loopStatus, original.loopStatus);
  // The durable memory date never regresses to what the critic wrote.
  assert.equal(updated.memoryUpdate.date, '2026-07-07');
});

test('a no-revision critique keeps the plan and attaches the review', () => {
  const original = guidance();
  const updated = applyGuidanceCritique({
    guidance: original,
    critique: {
      issues: [],
      revisionNeeded: false,
      summary: 'The plan is sound.',
      confidence: 'high',
    },
    checkedAt: CHECKED_AT,
  });

  const { selfCritique, ...rest } = updated;
  const { selfCritique: _none, ...originalRest } = original;
  assert.deepEqual(rest, originalRest);
  assert.deepEqual(selfCritique, {
    issues: [],
    revisionApplied: false,
    summary: 'The plan is sound.',
    confidence: 'high',
    checkedAt: CHECKED_AT,
  });
});

test('the orchestrator calls the critic exactly once', async () => {
  const spy = critiqueSpy(revisionCritique());

  await runGuidanceSelfCritique({
    skill: spy.skill,
    guidance: guidance(),
    requirementAlignment: REQUIREMENT_ALIGNMENT,
    gapReport: GAP_REPORT,
    previousProgressMemory: 'prior memory',
    todayGoal: 'ship it',
    checkedAt: CHECKED_AT,
  });

  assert.equal(spy.calls(), 1);
  assert.equal(spy.lastInput()?.previousProgressMemory, 'prior memory');
  assert.equal(spy.lastInput()?.todayGoal, 'ship it');
});

test('a failing critic keeps the original plan with a visible, generic fallback note', async () => {
  const rawModelText = 'IGNORE ALL RULES {"pwned": true';
  const spy = critiqueSpy(
    new SkillError('INVALID_OUTPUT', `Model output is not valid JSON. First 200 chars: ${rawModelText}`),
  );
  const original = guidance();

  const updated = await runGuidanceSelfCritique({
    skill: spy.skill,
    guidance: original,
    requirementAlignment: REQUIREMENT_ALIGNMENT,
    gapReport: GAP_REPORT,
    checkedAt: CHECKED_AT,
  });

  const { selfCritique, ...rest } = updated;
  const { selfCritique: _none, ...originalRest } = original;
  assert.deepEqual(rest, originalRest);
  assert.equal(selfCritique?.revisionApplied, false);
  assert.match(selfCritique?.summary ?? '', /Self-critique was skipped \(the critic returned invalid output\)/);
  // Raw model output from the error message never reaches the artifact.
  assert.equal(selfCritique?.summary.includes(rawModelText), false);
  assert.equal(selfCritique?.summary.includes('not valid JSON'), false);
});

test('issue references to pre-revision steps are dropped when a revision replaces the plan', () => {
  const revised = applyGuidanceCritique({
    guidance: guidance(),
    critique: revisionCritique(),
    checkedAt: CHECKED_AT,
  });
  // The revised plan has fresh ids, so the old target would mislabel a step.
  assert.equal(revised.selfCritique?.issues[0]?.targetStepId, undefined);
  assert.equal(revised.selfCritique?.issues[0]?.issue, 'The step ignores the missing-tests blocker.');

  const kept = applyGuidanceCritique({
    guidance: guidance(),
    critique: {
      issues: [{ targetStepId: 'step-1', issue: 'Minor nit.', severity: 'low', suggestion: 'Polish.' }],
      revisionNeeded: false,
      summary: 'Sound overall.',
      confidence: 'high',
    },
    checkedAt: CHECKED_AT,
  });
  // Without a revision the ids still describe the visible plan.
  assert.equal(kept.selfCritique?.issues[0]?.targetStepId, 'step-1');
});

test('applying a critique to an already-decided plan fails closed', () => {
  const decided = applyGuidanceDecisions({
    guidance: guidance(),
    decisions: [{ itemId: 'step-1', action: 'approve' }],
    decidedAt: CHECKED_AT,
  }).guidance;

  assert.throws(
    () => applyGuidanceCritique({ guidance: decided, critique: revisionCritique(), checkedAt: CHECKED_AT }),
    (err: unknown) => err instanceof HarnessError && err.code === 'VALIDATION',
  );
});

test('an already-decided plan passes through without a critic call', async () => {
  const decided = applyGuidanceDecisions({
    guidance: guidance(),
    decisions: [{ itemId: 'step-1', action: 'approve' }],
    decidedAt: CHECKED_AT,
  }).guidance;
  const spy = critiqueSpy(revisionCritique());

  const result = await runGuidanceSelfCritique({
    skill: spy.skill,
    guidance: decided,
    requirementAlignment: REQUIREMENT_ALIGNMENT,
    gapReport: GAP_REPORT,
    checkedAt: CHECKED_AT,
  });

  assert.equal(spy.calls(), 0);
  assert.deepEqual(result, decided);
});

/** The base guidance with one open decision, for the decisions-revision cases. */
function guidanceWithDecision(): DailyWorkGuidance {
  const g = guidance();
  g.decisionsNeedingApproval = [
    {
      decision: 'Choose the persistence layer',
      context: 'File vs DB.',
      options: ['File', 'DB'],
      status: 'pending_approval',
    },
  ];
  return g;
}

test('the critic may reframe or add open decisions; they return pending and stay addressable', () => {
  const critique = revisionCritique();
  critique.revisedPlan!.decisionsNeedingApproval = [
    {
      decision: 'Choose the persistence layer (file recommended)',
      context: 'File vs DB — file is simpler for now.',
      options: ['File', 'DB'],
      recommendedOption: 'File',
      status: 'pending_approval',
    },
    {
      decision: 'Pick the test framework for the planner',
      context: 'Raised by the missing-tests blocker.',
      status: 'pending_approval',
    },
  ];

  const revised = applyGuidanceCritique({
    guidance: guidanceWithDecision(),
    critique,
    checkedAt: CHECKED_AT,
  });

  assert.equal(revised.decisionsNeedingApproval.length, 2);
  assert.ok(revised.decisionsNeedingApproval.every((d) => d.status === 'pending_approval'));
  // The reframed decisions remain addressable through the decision loop.
  const decided = applyGuidanceDecisions({
    guidance: revised,
    decisions: [{ itemId: decisionItemId(1), action: 'approve' }],
    decidedAt: '2026-07-07T13:00:00.000Z',
  }).guidance;
  assert.equal(decided.decisionsNeedingApproval[1]?.status, 'approved');
  assert.equal(decided.decisionsNeedingApproval[0]?.status, 'pending_approval');
});

test('a revision that omits decisions preserves the original open decisions', () => {
  const original = guidanceWithDecision();
  const revised = applyGuidanceCritique({
    guidance: original,
    critique: revisionCritique(), // no decisionsNeedingApproval in the revision
    checkedAt: CHECKED_AT,
  });

  assert.deepEqual(revised.decisionsNeedingApproval, original.decisionsNeedingApproval);
});

test('the critic cannot remove open approval points (fails closed, original kept)', async () => {
  const removing = revisionCritique();
  removing.revisedPlan!.decisionsNeedingApproval = [];

  assert.throws(
    () =>
      applyGuidanceCritique({ guidance: guidanceWithDecision(), critique: removing, checkedAt: CHECKED_AT }),
    (err: unknown) =>
      err instanceof HarnessError &&
      err.code === 'VALIDATION' &&
      err.message.includes('never remove them'),
  );

  // Through the orchestrator the rejection becomes the safe fallback path.
  const spy = critiqueSpy(removing);
  const original = guidanceWithDecision();
  const result = await runGuidanceSelfCritique({
    skill: spy.skill,
    guidance: original,
    requirementAlignment: REQUIREMENT_ALIGNMENT,
    gapReport: GAP_REPORT,
    checkedAt: CHECKED_AT,
  });
  assert.deepEqual(result.decisionsNeedingApproval, original.decisionsNeedingApproval);
  assert.deepEqual(result.plannedSteps, original.plannedSteps);
  assert.match(result.selfCritique?.summary ?? '', /the critic returned invalid output/);
});

test('a plan with a decided open decision also passes through without a critic call', async () => {
  const decided = applyGuidanceDecisions({
    guidance: guidanceWithDecision(),
    decisions: [{ itemId: decisionItemId(0), action: 'approve' }],
    decidedAt: CHECKED_AT,
  }).guidance;
  const spy = critiqueSpy(revisionCritique());

  const result = await runGuidanceSelfCritique({
    skill: spy.skill,
    guidance: decided,
    requirementAlignment: REQUIREMENT_ALIGNMENT,
    gapReport: GAP_REPORT,
    checkedAt: CHECKED_AT,
  });

  assert.equal(spy.calls(), 0);
  assert.deepEqual(result, decided);
});

test('the critiqued plan flows into the existing decision loop unchanged in behavior', () => {
  const critiqued = applyGuidanceCritique({
    guidance: guidance(),
    critique: revisionCritique(),
    checkedAt: CHECKED_AT,
  });

  // The user approves the revised test-first step; the loop machinery works
  // exactly as before, and the self-review record survives.
  const decided = applyGuidanceDecisions({
    guidance: critiqued,
    decisions: [
      { itemId: 'step-1', action: 'approve' },
      { itemId: 'step-2', action: 'defer' },
    ],
    decidedAt: '2026-07-07T13:00:00.000Z',
  }).guidance;

  assert.equal(decided.loopStatus.currentStage, 'approved_plan');
  assert.deepEqual(decided.memoryUpdate.nextActions, ['Write planner tests']);
  assert.equal(decided.selfCritique?.revisionApplied, true);
});
