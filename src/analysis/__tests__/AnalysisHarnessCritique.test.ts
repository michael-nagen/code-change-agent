import { test } from 'node:test';
import assert from 'node:assert/strict';

import { AnalysisHarness } from '../AnalysisHarness.js';
import type {
  ChangeExplanation,
  ChangeExplanationSkill,
} from '../../skills/changeExplanation/index.js';
import type {
  RequirementAlignment,
  RequirementAlignmentSkill,
} from '../../skills/requirementAlignment/index.js';
import type { FlowArtifact, FlowGenerationSkill } from '../../skills/flowGeneration/index.js';
import type { GapReport, GapReportSkill } from '../../skills/gapReport/index.js';
import type {
  DailyWorkGuidance,
  DailyWorkGuidanceSkill,
} from '../../skills/dailyWorkGuidance/index.js';
import type {
  GuidanceCritiqueInput,
  GuidanceCritiqueSkill,
  GuidancePlanCritique,
} from '../../skills/dailyWorkGuidanceCritique/index.js';

const CHANGE_EXPLANATION: ChangeExplanation = {
  changeStory: 'Adds a planning stage.',
  keyFunctionalities: ['Planning'],
  flow: ['Input', 'Plan'],
  mainComponents: [{ name: 'Planner', responsibility: 'Plans.' }],
  architecturalDecisions: [],
  impactAnalysis: [],
  uncertainties: [],
};

const REQUIREMENT_ALIGNMENT: RequirementAlignment = {
  requirementSummary: 'Add planning',
  satisfiedItems: [],
  partiallySatisfiedItems: [],
  missingItems: [],
  unclearItems: [],
  overallAssessment: 'ok',
  confidence: 'high',
};

const FLOW_ARTIFACT: FlowArtifact = {
  title: 'Flow',
  description: 'Runtime flow.',
  steps: ['a'],
  mermaid: 'flowchart TD\n A --> B',
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
    blockers: 'None.',
    decisionsNeeded: 'None.',
    progressVsSpec: 'Planning done.',
    nextCursorPrompt: 'Draft a PR.',
  },
  memoryUpdate: {
    date: '2026-07-07',
    dailySummary: 'Planning done.',
    updatedChecklistStatuses: [],
    newDecisions: [],
    openBlockers: [],
    nextActions: ['Open the PR'],
  },
};

const CRITIQUE: GuidancePlanCritique = {
  issues: [
    {
      targetStepId: 'step-1',
      issue: 'Ignores the missing-tests gap.',
      severity: 'high',
      suggestion: 'Test-first.',
    },
  ],
  revisionNeeded: true,
  summary: 'Revised to test-first.',
  confidence: 'high',
  revisedPlan: {
    plannedSteps: [
      {
        title: 'Write planner tests',
        whyItMatters: 'Blocker first.',
        expectedOutput: 'Tests pass.',
        cursorPrompt: 'Write tests.',
        validationChecklist: ['npm test passes.'],
        status: 'pending_approval',
      },
    ],
    notionDailyUpdate: { ...GUIDANCE.notionDailyUpdate, today: 'Tests first.' },
    memoryUpdate: { ...GUIDANCE.memoryUpdate, nextActions: ['Write planner tests'] },
  },
};

function makeHarness(): {
  harness: AnalysisHarness;
  counts: { guidance: number; critique: number };
  lastCritiqueInput: () => GuidanceCritiqueInput | undefined;
} {
  const counts = { guidance: 0, critique: 0 };
  let lastInput: GuidanceCritiqueInput | undefined;
  const changeExplanation: ChangeExplanationSkill = {
    name: 's',
    async execute() {
      return structuredClone(CHANGE_EXPLANATION);
    },
  };
  const requirementAlignment: RequirementAlignmentSkill = {
    name: 's',
    async execute() {
      return structuredClone(REQUIREMENT_ALIGNMENT);
    },
  };
  const flowGeneration: FlowGenerationSkill = {
    name: 's',
    async execute() {
      return structuredClone(FLOW_ARTIFACT);
    },
  };
  const gapReport: GapReportSkill = {
    name: 's',
    async execute() {
      return structuredClone(GAP_REPORT);
    },
  };
  const dailyWorkGuidance: DailyWorkGuidanceSkill = {
    name: 's',
    async execute() {
      counts.guidance += 1;
      return structuredClone(GUIDANCE);
    },
  };
  const dailyWorkGuidanceCritique: GuidanceCritiqueSkill = {
    name: 'spy-critique',
    async execute(input: GuidanceCritiqueInput) {
      counts.critique += 1;
      lastInput = input;
      return structuredClone(CRITIQUE);
    },
  };
  const harness = new AnalysisHarness({
    changeExplanation,
    requirementAlignment,
    flowGeneration,
    gapReport,
    dailyWorkGuidance,
    dailyWorkGuidanceCritique,
  });
  return { harness, counts, lastCritiqueInput: () => lastInput };
}

test('the self-critique runs exactly once after generation and revises the shown plan', async () => {
  const { harness, counts } = makeHarness();

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add planning',
    includeDailyWorkGuidance: true,
  });

  assert.equal(counts.guidance, 1);
  assert.equal(counts.critique, 1);
  const shown = result.dailyWorkGuidance;
  assert.ok(shown);
  // The user sees the revised, still-pending plan with the review attached.
  assert.equal(shown.plannedSteps![0]?.title, 'Write planner tests');
  assert.equal(shown.plannedSteps![0]?.status, 'pending_approval');
  assert.equal(shown.selfCritique?.revisionApplied, true);
  // The factual sections come from the original generation.
  assert.equal(shown.yesterdaySummary, GUIDANCE.yesterdaySummary);
});

test('the critic receives the generated plan and the run evidence', async () => {
  const { harness, lastCritiqueInput } = makeHarness();

  await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add planning',
    includeDailyWorkGuidance: true,
  });

  const input = lastCritiqueInput();
  assert.ok(input);
  assert.deepEqual(input.guidance, GUIDANCE);
  assert.deepEqual(input.gapReport, GAP_REPORT);
  assert.deepEqual(input.requirementAlignment, REQUIREMENT_ALIGNMENT);
});

test('no repeated critique: a session re-run reuses the artifact without another pass', async () => {
  const { harness, counts } = makeHarness();

  const first = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add planning',
    includeDailyWorkGuidance: true,
  });
  await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add planning',
    sessionId: first.sessionId,
    includeDailyWorkGuidance: true,
  });

  assert.equal(counts.guidance, 1);
  assert.equal(counts.critique, 1);
});
