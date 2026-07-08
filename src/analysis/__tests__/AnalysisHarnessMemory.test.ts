import { test } from 'node:test';
import assert from 'node:assert/strict';

import { AnalysisHarness } from '../AnalysisHarness.js';
import { applyGuidanceDecisions } from '../applyGuidanceDecisions.js';
import { InMemoryMemoryStore } from '../../memory/index.js';
import type { MemoryStore, ProjectMemory, UserPreferencesMemory } from '../../memory/index.js';
import type {
  ChangeExplanation,
  ChangeExplanationInput,
  ChangeExplanationSkill,
} from '../../skills/changeExplanation/index.js';
import type {
  RequirementAlignment,
  RequirementAlignmentInput,
  RequirementAlignmentSkill,
} from '../../skills/requirementAlignment/index.js';
import type {
  FlowArtifact,
  FlowGenerationInput,
  FlowGenerationSkill,
} from '../../skills/flowGeneration/index.js';
import type { GapReport, GapReportInput, GapReportSkill } from '../../skills/gapReport/index.js';
import type {
  DailyWorkGuidance,
  DailyWorkGuidanceInput,
  DailyWorkGuidanceSkill,
} from '../../skills/dailyWorkGuidance/index.js';

const CHANGE_EXPLANATION: ChangeExplanation = {
  changeStory: 'Adds a planning stage before execution.',
  keyFunctionalities: ['Supports planning before execution'],
  flow: ['Input received', 'Plan built', 'Execution'],
  mainComponents: [{ name: 'Planner', responsibility: 'Builds a plan.' }],
  architecturalDecisions: ['Planning separated from execution'],
  impactAnalysis: ['Execution depends on planning'],
  uncertainties: [],
};

const REQUIREMENT_ALIGNMENT: RequirementAlignment = {
  requirementSummary: 'Add a planning stage before execution.',
  satisfiedItems: ['Planning stage is present'],
  partiallySatisfiedItems: [],
  missingItems: [],
  unclearItems: [],
  overallAssessment: 'Appears implemented.',
  confidence: 'high',
};

const FLOW_ARTIFACT: FlowArtifact = {
  title: 'Planning — Runtime Flow',
  description: 'Shows how the change operates at runtime.',
  steps: ['Input received', 'Plan built', 'Execution'],
  mermaid: 'flowchart TD\n  S1 --> S2',
};

const GAP_REPORT: GapReport = {
  readiness: 'ready',
  completedWork: ['Planning stage is present'],
  remainingGaps: [],
  partialItems: [],
  unclearItems: [],
  risks: [],
  recommendedNextActions: ['Open the PR.'],
  prRecommendation: 'Ready to open a PR.',
};

const GUIDANCE: DailyWorkGuidance = {
  loopStatus: { currentStage: 'planning', overallStatus: 'pending_user_review' },
  yesterdaySummary: 'Implemented the planning stage.',
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
  ],
  notionDailyUpdate: {
    yesterday: 'Built planning.',
    today: 'Open the PR.',
    blockers: 'None.',
    decisionsNeeded: 'None.',
    progressVsSpec: 'Planning done.',
    nextCursorPrompt: 'Draft a PR.',
  },
  memoryUpdate: {
    date: '2026-07-07',
    dailySummary: 'Planning done; ready to open PR.',
    updatedChecklistStatuses: [{ item: 'Planning stage', status: 'done' }],
    newDecisions: [],
    openBlockers: [],
    nextActions: ['Open the PR'],
  },
};

/** Skill doubles covering the base pipeline plus a capturing daily-work-guidance. */
function makeSkills() {
  let lastGuidanceInput: DailyWorkGuidanceInput | undefined;

  const changeExplanation: ChangeExplanationSkill = {
    name: 'spy-change-explanation',
    async execute(_i: ChangeExplanationInput) {
      return structuredClone(CHANGE_EXPLANATION);
    },
  };
  const requirementAlignment: RequirementAlignmentSkill = {
    name: 'spy-requirement-alignment',
    async execute(_i: RequirementAlignmentInput) {
      return structuredClone(REQUIREMENT_ALIGNMENT);
    },
  };
  const flowGeneration: FlowGenerationSkill = {
    name: 'spy-flow-generation',
    async execute(_i: FlowGenerationInput) {
      return structuredClone(FLOW_ARTIFACT);
    },
  };
  const gapReport: GapReportSkill = {
    name: 'spy-gap-report',
    async execute(_i: GapReportInput) {
      return structuredClone(GAP_REPORT);
    },
  };
  const dailyWorkGuidance: DailyWorkGuidanceSkill = {
    name: 'spy-daily-work-guidance',
    async execute(input: DailyWorkGuidanceInput) {
      lastGuidanceInput = input;
      return structuredClone(GUIDANCE);
    },
  };

  return {
    skills: { changeExplanation, requirementAlignment, flowGeneration, gapReport, dailyWorkGuidance },
    getLastGuidanceInput: () => lastGuidanceInput,
  };
}

function run(harness: AnalysisHarness, extra: Record<string, unknown> = {}) {
  return harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    includeDailyWorkGuidance: true,
    ...extra,
  });
}

test('with no projectId, no memory is loaded and behavior is unchanged', async () => {
  const { skills, getLastGuidanceInput } = makeSkills();
  const memoryStore = new InMemoryMemoryStore();
  const harness = new AnalysisHarness({ ...skills, memoryStore });

  await run(harness);

  const input = getLastGuidanceInput();
  assert.ok(input);
  assert.equal(input.previousProgressMemory, undefined);
});

test('project memory feeds previousProgressMemory into daily work guidance', async () => {
  const { skills, getLastGuidanceInput } = makeSkills();
  const memoryStore = new InMemoryMemoryStore();
  const projectMemory: ProjectMemory = {
    schemaVersion: 1,
    userId: 'local',
    projectId: 'demo',
    latestSnapshot: {
      date: '2026-07-06',
      dailySummary: 'Yesterday: scaffolding only.',
      updatedChecklistStatuses: [{ item: 'Planning stage', status: 'missing' }],
      openBlockers: [],
      openDecisions: [],
      nextActions: ['Build the planner'],
    },
    history: [],
    updatedAt: '2026-07-06T00:00:00.000Z',
  };
  await memoryStore.saveProjectMemory({ userId: 'local', projectId: 'demo', memory: projectMemory });

  const harness = new AnalysisHarness({ ...skills, memoryStore });
  await run(harness, { projectId: 'demo' });

  const input = getLastGuidanceInput();
  assert.ok(input);
  assert.ok(input.previousProgressMemory);
  assert.match(input.previousProgressMemory, /scaffolding only/);
});

test('explicit previousProgressMemory overrides stored memory (current input is source of truth)', async () => {
  const { skills, getLastGuidanceInput } = makeSkills();
  const memoryStore = new InMemoryMemoryStore();
  await memoryStore.saveProjectMemory({
    userId: 'local',
    projectId: 'demo',
    memory: {
      schemaVersion: 1,
      userId: 'local',
      projectId: 'demo',
      latestSnapshot: {
        date: '2026-07-06',
        dailySummary: 'STORED MEMORY',
        updatedChecklistStatuses: [],
        openBlockers: [],
        openDecisions: [],
        nextActions: [],
      },
      history: [],
      updatedAt: '2026-07-06T00:00:00.000Z',
    },
  });

  const harness = new AnalysisHarness({ ...skills, memoryStore });
  await run(harness, { projectId: 'demo', previousProgressMemory: 'EXPLICIT INPUT' });

  const input = getLastGuidanceInput();
  assert.ok(input);
  assert.equal(input.previousProgressMemory, 'EXPLICIT INPUT');
});

test('user memory defaultGoal fills todayGoal only when none is provided', async () => {
  const { skills, getLastGuidanceInput } = makeSkills();
  const memoryStore = new InMemoryMemoryStore();
  const userMemory: UserPreferencesMemory = {
    schemaVersion: 1,
    userId: 'local',
    preferences: [],
    defaultGoal: 'Ship the MVP today',
    updatedAt: '2026-07-06T00:00:00.000Z',
  };
  await memoryStore.saveUserMemory({ userId: 'local', memory: userMemory });

  const harness = new AnalysisHarness({ ...skills, memoryStore });
  await run(harness, { projectId: 'demo' });

  const input = getLastGuidanceInput();
  assert.ok(input);
  assert.equal(input.todayGoal, 'Ship the MVP today');
});

test('user promptPreferences are rendered into the daily work guidance input', async () => {
  const { skills, getLastGuidanceInput } = makeSkills();
  const memoryStore = new InMemoryMemoryStore();
  const userMemory: UserPreferencesMemory = {
    schemaVersion: 1,
    userId: 'local',
    preferences: [],
    promptPreferences: {
      general: { preferredTone: 'concise' },
      dailyUpdate: ['Notion-ready'],
      cursor: ['task-first'],
      // A category not requested by daily work guidance must NOT leak in.
      codeReview: ['be blunt'],
    },
    updatedAt: '2026-07-06T00:00:00.000Z',
  };
  await memoryStore.saveUserMemory({ userId: 'local', memory: userMemory });

  const harness = new AnalysisHarness({ ...skills, memoryStore });
  await run(harness, { projectId: 'demo' });

  const input = getLastGuidanceInput();
  assert.ok(input?.userPromptPreferences);
  assert.match(input.userPromptPreferences, /concise/);
  assert.match(input.userPromptPreferences, /Notion-ready/);
  assert.match(input.userPromptPreferences, /task-first/);
  assert.equal(input.userPromptPreferences.includes('be blunt'), false);
});

test('saveProjectMemoryFromGuidance persists a snapshot that feeds the next run', async () => {
  const { skills, getLastGuidanceInput } = makeSkills();
  const memoryStore = new InMemoryMemoryStore();
  const harness = new AnalysisHarness({ ...skills, memoryStore });

  const first = await run(harness, { projectId: 'demo' });
  assert.ok(first.dailyWorkGuidance);
  await harness.saveProjectMemoryFromGuidance({
    projectId: 'demo',
    guidance: first.dailyWorkGuidance,
  });

  const stored = await harness.getProjectMemory({ projectId: 'demo' });
  assert.ok(stored?.latestSnapshot);
  assert.equal(stored.latestSnapshot.dailySummary, 'Planning done; ready to open PR.');

  // A fresh run (new session) should now receive that saved progress.
  await run(harness, { projectId: 'demo' });
  const input = getLastGuidanceInput();
  assert.ok(input?.previousProgressMemory);
  assert.match(input.previousProgressMemory, /Planning done; ready to open PR/);
});

test('the full loop: run 1 → user decisions → saved memory → run 2 reloads the decided plan', async () => {
  const { skills, getLastGuidanceInput } = makeSkills();
  const memoryStore = new InMemoryMemoryStore();
  const harness = new AnalysisHarness({ ...skills, memoryStore });

  // Run 1 proposes a plan whose items are pending the user's approval.
  const first = await run(harness, { projectId: 'demo' });
  assert.ok(first.dailyWorkGuidance);
  assert.equal(first.dailyWorkGuidance.loopStatus.currentStage, 'planning');
  assert.equal(first.dailyWorkGuidance.plannedSteps[0]?.status, 'pending_approval');

  // The user decides; the loop stage advances (stage N → stage N+1).
  const { guidance: decided } = applyGuidanceDecisions({
    guidance: first.dailyWorkGuidance,
    decisions: [{ itemId: 'step-1', action: 'approve', note: 'Ship it' }],
    decidedAt: '2026-07-07T12:00:00.000Z',
  });
  assert.equal(decided.loopStatus.currentStage, 'approved_plan');

  // The decided plan is persisted as project memory.
  await harness.saveProjectMemoryFromGuidance({ projectId: 'demo', guidance: decided });
  const stored = await harness.getProjectMemory({ projectId: 'demo' });
  assert.equal(stored?.latestSnapshot?.loopStage, 'approved_plan');
  assert.deepEqual(stored?.latestSnapshot?.planDecisions, [
    { itemId: 'step-1', action: 'approve', text: 'Open the PR', note: 'Ship it' },
  ]);

  // Run 2 for the same project reloads that memory into the skill's input.
  await run(harness, { projectId: 'demo' });
  const input = getLastGuidanceInput();
  assert.ok(input?.previousProgressMemory);
  assert.match(input.previousProgressMemory, /Plan loop stage: approved_plan/);
  assert.match(input.previousProgressMemory, /\[approve\] step-1: Open the PR — Ship it/);
});

test('a failing memory store never crashes the analysis (fails open)', async () => {
  const { skills, getLastGuidanceInput } = makeSkills();
  const throwing: MemoryStore = {
    async getUserMemory() {
      throw new Error('boom');
    },
    async saveUserMemory() {},
    async getProjectMemory() {
      throw new Error('boom');
    },
    async saveProjectMemory() {},
  };
  const harness = new AnalysisHarness({ ...skills, memoryStore: throwing });

  const result = await run(harness, { projectId: 'demo' });
  assert.ok(result.dailyWorkGuidance);
  const input = getLastGuidanceInput();
  assert.ok(input);
  assert.equal(input.previousProgressMemory, undefined);
});
