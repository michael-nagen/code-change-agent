import { test } from 'node:test';
import assert from 'node:assert/strict';

import { AnalysisHarness } from '../AnalysisHarness.js';
import { InMemoryMemoryStore } from '../../memory/index.js';
import { HarnessError } from '../../errors/HarnessError.js';
import { InMemoryArtifactStore } from '../InMemoryArtifactStore.js';
import { ANALYZE_CODE_CHANGE_WORKFLOW } from '../workflowDefinition.js';
import type { AnalysisSession } from '../types/index.js';
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
  GapReport,
  GapReportInput,
  GapReportSkill,
} from '../../skills/gapReport/index.js';
import type {
  FlowArtifact,
  FlowGenerationInput,
  FlowGenerationSkill,
} from '../../skills/flowGeneration/index.js';
import type {
  PRDescription,
  PRDescriptionInput,
  PRDescriptionSkill,
} from '../../skills/prDescription/index.js';
import type {
  VideoScript,
  VideoScriptInput,
  VideoScriptSkill,
} from '../../skills/videoScript/index.js';
import type {
  DailyUpdate,
  DailyUpdateInput,
  DailyUpdateSkill,
} from '../../skills/dailyUpdate/index.js';
import type {
  DailyWorkGuidance,
  DailyWorkGuidanceInput,
  DailyWorkGuidanceSkill,
} from '../../skills/dailyWorkGuidance/index.js';
import type {
  TechnicalChangeBrief,
  TechnicalChangeBriefInput,
  TechnicalChangeBriefSkill,
} from '../../skills/technicalChangeBrief/index.js';
import type {
  DemoPrepLoop,
  DemoPrepLoopInput,
  DemoPrepLoopSkill,
} from '../../skills/demoPrepLoop/index.js';
import type {
  WeeklyReview,
  WeeklyReviewInput,
  WeeklyReviewSkill,
} from '../../skills/weeklyReview/index.js';
import type { GitInputAdapter, GitInputAdapterInput } from '../../tools/index.js';

const CHANGE_EXPLANATION: ChangeExplanation = {
  changeStory: 'The system now supports planning before execution.',
  keyFunctionalities: ['Supports planning before execution'],
  flow: ['Input received', 'Plan built', 'Execution'],
  mainComponents: [{ name: 'Planner', responsibility: 'Builds a plan from inputs.' }],
  architecturalDecisions: ['Planning separated from execution'],
  impactAnalysis: ['Execution flow now depends on a planning stage'],
  uncertainties: ['Whether tests were updated'],
};

const REQUIREMENT_ALIGNMENT: RequirementAlignment = {
  requirementSummary: 'Add a planning stage before execution.',
  satisfiedItems: ['Planning stage is present'],
  partiallySatisfiedItems: [],
  missingItems: [],
  unclearItems: [],
  overallAssessment: 'The requested planning capability appears implemented.',
  confidence: 'high',
};

const GAP_REPORT: GapReport = {
  readiness: 'ready',
  completedWork: ['Planning stage is present'],
  remainingGaps: [],
  partialItems: [],
  unclearItems: [],
  risks: [],
  recommendedNextActions: ['No blocking work remains — open the PR.'],
  prRecommendation: 'Ready to open a PR — no meaningful gaps detected.',
};

const FLOW_ARTIFACT: FlowArtifact = {
  title: 'Planning — Runtime Flow',
  description: 'Shows how the change operates at runtime.',
  steps: ['Input received', 'Plan built', 'Execution'],
  mermaid: 'flowchart TD\n  S1["Input received"] --> S2["Plan built"]',
};

const PR_DESCRIPTION: PRDescription = {
  title: 'Supports planning before execution',
  summary: 'Adds a planning stage.',
  whatChanged: ['Supports planning before execution'],
  requirementCoverage: ['Satisfied: Planning stage is present'],
  featureFlow: 'Flow\n\n```mermaid\nflowchart TD\n  S1["Input received"]\n```',
  testingNotes: ['No automated test results are included in these artifacts; run the test suite before merging.'],
  risksAndFollowUps: [],
};

const VIDEO_SCRIPT: VideoScript = {
  title: 'Planning before execution — walkthrough',
  targetAudience: 'Reviewing developers',
  estimatedDuration: '~90 seconds',
  sections: [
    { title: 'What changed', narration: 'We added a planning stage.', visualCue: 'Show the planner.' },
  ],
  keyTakeaways: ['Ready to open a PR.'],
};

const DAILY_UPDATE: DailyUpdate = {
  headline: 'Planning before execution is in progress (readiness: ready).',
  yesterdaySummary: ['Supports planning before execution.'],
  todaySuggestions: ['Open the PR.'],
  blockersOrRisks: ['No known blockers or risks.'],
  highlightedTopic: {
    title: 'Planning separated from execution',
    explanation: 'Planning is separated from execution.',
    whyItMatters: 'It shapes how the change behaves.',
  },
  spokenVersion: 'Yesterday I built planning. Today I will open the PR.',
};

const DAILY_WORK_GUIDANCE: DailyWorkGuidance = {
  headline: 'Planning built; next steps queued.',
  whatChanged: ['Built the planning stage.'],
  nextActions: ['Open the PR.'],
  blockersOrDecisions: [],
  loopStatus: { currentStage: 'planning', overallStatus: 'pending_user_review' },
  yesterdaySummary: 'Implemented the planning stage before execution.',
  progressVsSpec: [
    {
      item: 'Add a planning stage before execution',
      whatChanged: 'The planning stage was implemented.',
      newStatus: 'done',
      evidence: 'The requirement alignment lists the planning stage as satisfied.',
      confidence: 'high',
    },
  ],
  advancedChecklistItems: [
    {
      item: 'Add a planning stage before execution',
      previousStatus: 'missing',
      newStatus: 'done',
      whatAdvanced: 'The planning stage went from missing to implemented.',
      evidence: 'The change explanation describes the new planning stage.',
    },
  ],
  blockersAndRisks: [],
  decisionsNeedingApproval: [],
  plannedSteps: [
    {
      id: 'step-1',
      title: 'Open the PR',
      whyItMatters: 'The change is ready to review.',
      expectedOutput: 'A PR is opened.',
      cursorPrompt: 'Draft a PR for the planning stage.',
      validationChecklist: ['The PR builds and tests pass.'],
      status: 'pending_approval',
    },
  ],
  notionDailyUpdate: {
    yesterday: 'Built the planning stage.',
    today: 'Open the PR.',
    blockers: 'None.',
    decisionsNeeded: 'None.',
    progressVsSpec: 'Planning stage done.',
    nextCursorPrompt: 'Draft a PR for the planning stage.',
  },
  memoryUpdate: {
    date: '2026-07-07',
    dailySummary: 'Planning stage done; ready to open a PR.',
    updatedChecklistStatuses: [
      { item: 'Add a planning stage before execution', status: 'done' },
    ],
    newDecisions: [],
    openBlockers: [],
    nextActions: ['Open the PR'],
  },
};

const TECHNICAL_CHANGE_BRIEF: TechnicalChangeBrief = {
  executiveSummary: 'Adds a planning stage before execution.',
  dataSchemaChanges: {
    hasChanges: false,
    summary: 'No data or schema changes.',
    newFields: [],
    changedFields: [],
    removedFields: [],
    newSchemas: [],
    changedParserContracts: [],
    newStatusValues: [],
    persistedDataImpact: 'No persisted data affected.',
    backwardCompatibility: 'compatible',
    backwardCompatibilityNote: 'Additive only.',
  },
  modelsAndTypes: [
    {
      name: 'Planner',
      filePath: 'src/planner.ts',
      represents: 'The planning stage.',
      whyNeeded: 'To plan before executing.',
      importantFields: ['steps: the planned steps'],
      evidence: 'confirmed',
    },
  ],
  inputsApiFlags: [],
  workflowRuntimeChanges: {
    summary: 'A planning stage runs before execution.',
    whereItRuns: 'Before execution.',
    dependsOn: ['Input'],
    consumesArtifacts: ['None'],
    producesArtifact: 'A plan',
    cachedOrReused: 'Not cached.',
    behaviorWhenFlagOff: 'Execution runs without a plan.',
  },
  uiChanges: {
    hasChanges: false,
    summary: 'No UI changes.',
    newCardsOrViews: [],
    togglesOrButtons: [],
    copyActions: [],
    sectionsDisplayed: [],
    howToActivate: 'not visible from the provided diff/analysis',
  },
  interestingFunctionality: [
    {
      title: 'Planning stage',
      whatItDoes: 'Builds a plan.',
      whyItMatters: 'Separates planning from execution.',
      howItWorks: 'Reads inputs and emits ordered steps.',
      filesInvolved: ['src/planner.ts'],
    },
  ],
  howItWorksStepByStep: [
    { actor: 'User', action: 'Provides input.' },
    { action: 'Planner builds a plan.', detail: 'Ordered steps.' },
  ],
  filesWorthShowing: [
    {
      path: 'src/planner.ts',
      whyItMatters: 'It holds the planning logic.',
      whatToPointOut: 'The plan-building function.',
    },
  ],
  talkingPoints: ['We added a planning stage before execution.'],
};

const DEMO_PREP_LOOP: DemoPrepLoop = {
  loopStatus: {
    currentStage: 'Initial demo plan proposed.',
    overallStatus: 'pending_user_review',
    nextRecommendedAction: 'Review the walkthrough order.',
    whatNeedsUserApproval: ['Demo story'],
  },
  demoStoryProposal: {
    problem: 'Execution ran without a plan.',
    solution: 'A planning stage before execution.',
    technicalChange: 'A Planner builds ordered steps first.',
    userOrProductValue: 'Predictable execution.',
    proofOrDemoMoment: 'A run shows the plan before execution.',
    limitationsOrNextSteps: 'Plans are not persisted.',
    status: 'pending_approval',
  },
  walkthroughOrder: [
    {
      order: 1,
      title: 'The Planner',
      filePath: 'src/planner.ts',
      type: 'code',
      whyThisComesHere: 'The planning logic anchors the story.',
      whatToShow: 'The plan-building function.',
      whatToSay: 'Planning is separated from execution.',
      whatToSkip: 'Helper utilities.',
      relatedFeatureOrConcept: 'Planning stage',
      estimatedTimeSeconds: 45,
      mustShow: true,
      evidence: 'confirmed',
      status: 'pending_approval',
    },
  ],
  codeEvidencePlan: [
    {
      filePath: 'src/planner.ts',
      evidenceType: 'workflow',
      whatItProves: 'Planning runs before execution.',
      whyItMatters: 'It is the core of the change.',
      confidence: 'high',
      evidence: 'confirmed',
      status: 'pending_approval',
    },
  ],
  screenshotPlan: [
    {
      id: 'shot-1',
      title: 'Planner code',
      type: 'code',
      filePath: 'src/planner.ts',
      whatToCapture: 'The plan-building function.',
      whyThisMatters: 'It proves the planning stage exists.',
      whatToSay: 'This is where the plan is built.',
      whatToSkip: 'Imports.',
      relatedFeatureOrConcept: 'Planning stage',
      estimatedTimeSeconds: 30,
      mustShow: true,
      suggestedCaption: 'The Planner builds ordered steps.',
      evidence: 'confirmed',
      status: 'pending_approval',
    },
  ],
  approvalQuestions: [
    {
      question: 'Focus on the planner or the execution flow?',
      whyItMatters: 'It decides which slides carry the story.',
      options: ['Planner', 'Execution flow'],
      status: 'pending_approval',
    },
  ],
  deckPlan: [
    {
      slideNumber: 1,
      title: 'Planning before execution',
      purpose: 'Introduce the change.',
      visualType: 'code_screenshot',
      screenshotIds: ['shot-1'],
      whatToShow: 'The Planner screenshot.',
      onSlideText: ['Plan first', 'Then execute'],
      speakerNotes: 'Explain why planning was separated.',
      narrationScript: 'We now build a plan before executing.',
      transitionToNextSlide: 'Here is how it runs.',
      estimatedTimeSeconds: 40,
      mustHave: true,
      status: 'draft',
    },
  ],
  draftVideoScript: {
    title: 'Planning before execution',
    estimatedDuration: '5-7 minutes',
    sections: [
      {
        kind: 'opening',
        title: 'Intro',
        narration: 'This walkthrough covers the new planning stage.',
        visualCue: 'Title slide.',
        estimatedTimeSeconds: 30,
      },
    ],
  },
  finalShortPitch: 'We added a planning stage so execution is predictable.',
  readinessChecklist: [
    { item: 'Run tests', why: 'Prove the change is green.', done: false },
  ],
};

const WEEKLY_REVIEW: WeeklyReview = {
  status: {
    status: 'draft',
    confidence: 'medium',
    missingInputs: [],
    reviewPeriodLabel: 'Week ending 2026-07-07',
    generatedAt: '2026-07-07T09:00:00.000Z',
  },
  executiveSummary: 'Built the planning stage; ready to open the PR.',
  progressAgainstSpec: [
    {
      title: 'Add a planning stage before execution',
      status: 'done',
      evidence: 'Alignment lists it satisfied.',
      notes: 'No conflict with memory.',
      source: 'current_run',
    },
  ],
  whatChangedTechnically: {
    schemaOrDataChanges: [],
    modelOrTypeChanges: [],
    workflowOrRuntimeChanges: [
      { description: 'Planning runs before execution.', evidence: 'confirmed' },
    ],
    uiChanges: [],
    toolsOrSkillsAdded: [],
    importantFilesOrModules: ['src/planner.ts'],
  },
  keyDecisions: [
    {
      decision: 'Separate planning from execution.',
      why: 'Clearer responsibilities.',
      impact: 'Execution depends on planning.',
      status: 'active',
      source: 'current_run',
    },
  ],
  blockersAndRisks: [],
  demoVideoStory: {
    strongestStory: 'Planning now happens before execution.',
    whatToShow: ['The planner'],
    whatToSay: ['Why planning is separated'],
    whatToSkip: ['Boilerplate'],
    recommendedStructure: [{ title: 'Intro', durationLabel: '~1 min', focus: 'The problem' }],
    keyFilesOrScreens: ['src/planner.ts'],
    strongestProductSentence: 'Plans are first-class before execution.',
  },
  reviewTalkingPoints: ['I built the planning stage.'],
  suggestedWeeklyUpdate: {
    thisWeek: 'Built planning.',
    technicalProgress: 'Planner added.',
    demoProductProgress: 'Can demo planning.',
    blockers: 'None.',
    nextWeek: 'Open the PR.',
  },
  nextWeekPlan: ['Open the PR.'],
  memoryUpdateProposal: {
    latestWeeklySummary: 'Planning stage done; ready to open PR.',
    updatedChecklistStatuses: [{ item: 'Add a planning stage before execution', status: 'done' }],
    newDecisions: ['Separate planning from execution.'],
    updatedBlockers: [],
    nextActions: ['Open the PR'],
    demoStorySummary: 'Planning before execution.',
    filesWorthShowing: ['src/planner.ts'],
  },
};

/**
 * Records call order and counts, and returns fixed artifacts. Crucially, these
 * fakes use no LanguageModel — proving the Harness is independent of any model
 * provider.
 */
function makeSpies() {
  const order: string[] = [];
  const counts = {
    changeExplanation: 0,
    flowGeneration: 0,
    requirementAlignment: 0,
    gapReport: 0,
    prDescription: 0,
    videoScript: 0,
    dailyUpdate: 0,
    dailyWorkGuidance: 0,
    technicalChangeBrief: 0,
    demoPrepLoop: 0,
    weeklyReview: 0,
  };
  let lastAlignmentInput: RequirementAlignmentInput | undefined;
  let lastGapReportInput: GapReportInput | undefined;
  let lastFlowInput: FlowGenerationInput | undefined;
  let lastPrInput: PRDescriptionInput | undefined;
  let lastVideoScriptInput: VideoScriptInput | undefined;
  let lastDailyUpdateInput: DailyUpdateInput | undefined;
  let lastDailyWorkGuidanceInput: DailyWorkGuidanceInput | undefined;
  let lastTechnicalChangeBriefInput: TechnicalChangeBriefInput | undefined;
  let lastDemoPrepLoopInput: DemoPrepLoopInput | undefined;
  let lastWeeklyReviewInput: WeeklyReviewInput | undefined;

  const changeExplanation: ChangeExplanationSkill = {
    name: 'spy-change-explanation',
    async execute(_input: ChangeExplanationInput): Promise<ChangeExplanation> {
      counts.changeExplanation += 1;
      order.push('changeExplanation');
      return structuredClone(CHANGE_EXPLANATION);
    },
  };

  const flowGeneration: FlowGenerationSkill = {
    name: 'spy-flow-generation',
    async execute(input: FlowGenerationInput): Promise<FlowArtifact> {
      counts.flowGeneration += 1;
      lastFlowInput = input;
      order.push('flowGeneration');
      return structuredClone(FLOW_ARTIFACT);
    },
  };

  const requirementAlignment: RequirementAlignmentSkill = {
    name: 'spy-requirement-alignment',
    async execute(input: RequirementAlignmentInput): Promise<RequirementAlignment> {
      counts.requirementAlignment += 1;
      lastAlignmentInput = input;
      order.push('requirementAlignment');
      return structuredClone(REQUIREMENT_ALIGNMENT);
    },
  };

  const gapReport: GapReportSkill = {
    name: 'spy-gap-report',
    async execute(input: GapReportInput): Promise<GapReport> {
      counts.gapReport += 1;
      lastGapReportInput = input;
      order.push('gapReport');
      return structuredClone(GAP_REPORT);
    },
  };

  const prDescription: PRDescriptionSkill = {
    name: 'spy-pr-description',
    async execute(input: PRDescriptionInput): Promise<PRDescription> {
      counts.prDescription += 1;
      lastPrInput = input;
      order.push('prDescription');
      return structuredClone(PR_DESCRIPTION);
    },
  };

  const videoScript: VideoScriptSkill = {
    name: 'spy-video-script',
    async execute(input: VideoScriptInput): Promise<VideoScript> {
      counts.videoScript += 1;
      lastVideoScriptInput = input;
      order.push('videoScript');
      return structuredClone(VIDEO_SCRIPT);
    },
  };

  const dailyUpdate: DailyUpdateSkill = {
    name: 'spy-daily-update',
    async execute(input: DailyUpdateInput): Promise<DailyUpdate> {
      counts.dailyUpdate += 1;
      lastDailyUpdateInput = input;
      order.push('dailyUpdate');
      return structuredClone(DAILY_UPDATE);
    },
  };

  const dailyWorkGuidance: DailyWorkGuidanceSkill = {
    name: 'spy-daily-work-guidance',
    async execute(input: DailyWorkGuidanceInput): Promise<DailyWorkGuidance> {
      counts.dailyWorkGuidance += 1;
      lastDailyWorkGuidanceInput = input;
      order.push('dailyWorkGuidance');
      return structuredClone(DAILY_WORK_GUIDANCE);
    },
  };

  const technicalChangeBrief: TechnicalChangeBriefSkill = {
    name: 'spy-technical-change-brief',
    async execute(input: TechnicalChangeBriefInput): Promise<TechnicalChangeBrief> {
      counts.technicalChangeBrief += 1;
      lastTechnicalChangeBriefInput = input;
      order.push('technicalChangeBrief');
      return structuredClone(TECHNICAL_CHANGE_BRIEF);
    },
  };

  const demoPrepLoop: DemoPrepLoopSkill = {
    name: 'spy-demo-prep-loop',
    async execute(input: DemoPrepLoopInput): Promise<DemoPrepLoop> {
      counts.demoPrepLoop += 1;
      lastDemoPrepLoopInput = input;
      order.push('demoPrepLoop');
      return structuredClone(DEMO_PREP_LOOP);
    },
  };

  const weeklyReview: WeeklyReviewSkill = {
    name: 'spy-weekly-review',
    async execute(input: WeeklyReviewInput): Promise<WeeklyReview> {
      counts.weeklyReview += 1;
      lastWeeklyReviewInput = input;
      order.push('weeklyReview');
      return structuredClone(WEEKLY_REVIEW);
    },
  };

  return {
    order,
    counts,
    changeExplanation,
    flowGeneration,
    requirementAlignment,
    gapReport,
    prDescription,
    videoScript,
    dailyUpdate,
    dailyWorkGuidance,
    technicalChangeBrief,
    demoPrepLoop,
    weeklyReview,
    getLastAlignmentInput: () => lastAlignmentInput,
    getLastGapReportInput: () => lastGapReportInput,
    getLastFlowInput: () => lastFlowInput,
    getLastPrInput: () => lastPrInput,
    getLastVideoScriptInput: () => lastVideoScriptInput,
    getLastDailyUpdateInput: () => lastDailyUpdateInput,
    getLastDailyWorkGuidanceInput: () => lastDailyWorkGuidanceInput,
    getLastTechnicalChangeBriefInput: () => lastTechnicalChangeBriefInput,
    getLastDemoPrepLoopInput: () => lastDemoPrepLoopInput,
    getLastWeeklyReviewInput: () => lastWeeklyReviewInput,
  };
}

test('runs the workflow steps in the correct order', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
  });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
  });

  assert.deepEqual(spies.order, [
    'changeExplanation',
    'flowGeneration',
    'requirementAlignment',
    'gapReport',
  ]);

  const session = harness.getSession(result.sessionId);
  assert.ok(session);
  assert.deepEqual(session.status.completedSteps, [
    'normalizeRequirement',
    'changeExplanation',
    'flowGeneration',
    'requirementAlignment',
    'gapReport',
  ]);
  assert.deepEqual(session.status.failedSteps, []);
  assert.equal(session.status.currentStep, undefined);
});

test('change explanation runs on the raw diff; alignment receives the explanation and diff fallback', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
  });

  await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: '  Add a planning stage before execution.  ',
  });

  const alignmentInput = spies.getLastAlignmentInput();
  assert.ok(alignmentInput);
  assert.equal(alignmentInput.requirementText, 'Add a planning stage before execution.');
  assert.deepEqual(alignmentInput.changeExplanation, CHANGE_EXPLANATION);
  assert.equal(alignmentInput.rawDiff, 'diff --git a b');
});

test('reuses existing artifacts and does not call skills again on re-run', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
  });

  const first = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
  });

  assert.equal(spies.counts.changeExplanation, 1);
  assert.equal(spies.counts.requirementAlignment, 1);

  const second = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    sessionId: first.sessionId,
  });

  assert.equal(second.sessionId, first.sessionId);
  assert.equal(spies.counts.changeExplanation, 1);
  assert.equal(spies.counts.requirementAlignment, 1);
});

test('reuses the session when the same sessionId is given the same inputs', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
  });

  const first = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    // Trailing whitespace differs but normalizes to the same requirement, so it
    // must still count as the same inputs (normalized identity, not raw text).
    requirementText: 'Add a planning stage before execution.',
  });

  const second = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: '  Add a planning stage before execution.  ',
    sessionId: first.sessionId,
  });

  assert.equal(second.sessionId, first.sessionId);
  assert.equal(spies.counts.changeExplanation, 1);
  assert.equal(spies.counts.requirementAlignment, 1);
  assert.deepEqual(second.changeExplanation, first.changeExplanation);
});

test('fails closed when a reused sessionId is given a different raw diff', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
  });

  const first = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
  });

  await assert.rejects(
    () =>
      harness.runAnalysis({
        rawDiff: 'diff --git a DIFFERENT',
        requirementText: 'Add a planning stage before execution.',
        sessionId: first.sessionId,
      }),
    (err: unknown) =>
      err instanceof HarnessError &&
      err.code === 'SESSION_INPUT_MISMATCH' &&
      /different code diff/.test(err.message),
  );

  // No skills re-run for the mismatched request (the guard rejects first).
  assert.equal(spies.counts.changeExplanation, 1);
  assert.equal(spies.counts.requirementAlignment, 1);
});

test('fails closed when a reused sessionId is given different requirement text', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
  });

  const first = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
  });

  await assert.rejects(
    () =>
      harness.runAnalysis({
        rawDiff: 'diff --git a b',
        requirementText: 'Completely different requirement.',
        sessionId: first.sessionId,
      }),
    (err: unknown) =>
      err instanceof HarnessError &&
      err.code === 'SESSION_INPUT_MISMATCH' &&
      /different requirement/.test(err.message),
  );

  assert.equal(spies.counts.changeExplanation, 1);
  assert.equal(spies.counts.requirementAlignment, 1);
});

test('does not return stale artifacts on input mismatch — the stored session is untouched', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
  });

  const first = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
  });
  const before = harness.getSession(first.sessionId);
  assert.ok(before);

  await assert.rejects(
    () =>
      harness.runAnalysis({
        rawDiff: 'diff --git a DIFFERENT',
        requirementText: 'A different requirement entirely.',
        sessionId: first.sessionId,
      }),
    /SESSION_INPUT_MISMATCH|different code diff|different requirement/,
  );

  // The mismatch produced no result to render; the original session is intact
  // and still describes the ORIGINAL inputs (never overwritten with new ones).
  const after = harness.getSession(first.sessionId);
  assert.ok(after);
  assert.equal(after.inputs.rawDiff, 'diff --git a b');
  assert.deepEqual(after.inputs.requirementInput, {
    requirementText: 'Add a planning stage before execution.',
    source: 'manual',
  });
  assert.deepEqual(after.artifacts.changeExplanation, CHANGE_EXPLANATION);
});

test('does not call a skill when its artifact already exists in the session', async () => {
  const spies = makeSpies();
  const store = new InMemoryArtifactStore();

  const now = new Date().toISOString();
  const seeded: AnalysisSession = {
    sessionId: 'seeded-1',
    inputs: {
      rawDiff: 'diff --git a b',
      requirementInput: { requirementText: 'Add a planning stage.', source: 'manual' },
    },
    artifacts: {
      changeExplanation: structuredClone(CHANGE_EXPLANATION),
      requirementAlignment: structuredClone(REQUIREMENT_ALIGNMENT),
    },
    status: {
      currentStep: undefined,
      completedSteps: ['normalizeRequirement', 'changeExplanation', 'requirementAlignment'],
      failedSteps: [],
    },
    metadata: { createdAt: now, updatedAt: now },
  };
  store.save(seeded);

  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    store,
  });

  await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage.',
    sessionId: 'seeded-1',
  });

  assert.equal(spies.counts.changeExplanation, 0);
  assert.equal(spies.counts.requirementAlignment, 0);
});

test('returns the expected structured result', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
  });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
  });

  assert.equal(typeof result.sessionId, 'string');
  assert.ok(result.sessionId.length > 0);
  assert.deepEqual(result.requirementInput, {
    requirementText: 'Add a planning stage before execution.',
    source: 'manual',
  });
  assert.deepEqual(result.changeExplanation, CHANGE_EXPLANATION);
  assert.deepEqual(result.requirementAlignment, REQUIREMENT_ALIGNMENT);
});

test('runs with purely in-memory skills, independent of any model provider', async () => {
  // The skills injected here construct no LanguageModel and reference no
  // provider; a successful run is the evidence of that independence.
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
  });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
  });

  assert.ok(result.changeExplanation);
  assert.ok(result.requirementAlignment);
});

test('rejects empty inputs without invoking any skill', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
  });

  await assert.rejects(
    () => harness.runAnalysis({ rawDiff: '   ', requirementText: 'something' }),
    /rawDiff must not be empty/,
  );
  assert.equal(spies.counts.changeExplanation, 0);
});

test('stores the gap report as a session artifact and in the result', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
  });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
  });

  assert.deepEqual(result.gapReport, GAP_REPORT);

  const session = harness.getSession(result.sessionId);
  assert.ok(session);
  assert.deepEqual(session.artifacts.gapReport, GAP_REPORT);
});

test('reuses an existing gap report and does not call the skill again', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
  });

  const first = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
  });
  assert.equal(spies.counts.gapReport, 1);

  await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    sessionId: first.sessionId,
  });
  assert.equal(spies.counts.gapReport, 1);
});

test('the gap report skill receives only the artifacts, never the raw diff', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
  });

  await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
  });

  const gapInput = spies.getLastGapReportInput();
  assert.ok(gapInput);
  assert.deepEqual(Object.keys(gapInput).sort(), ['changeExplanation', 'requirementAlignment']);
  assert.equal('rawDiff' in gapInput, false);
});

test('can skip the optional gap report step', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
  });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    includeGapReport: false,
  });

  assert.equal(spies.counts.gapReport, 0);
  assert.equal(result.gapReport, undefined);
});

test('stores the flow artifact as a session artifact and in the result', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
  });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
  });

  assert.deepEqual(result.flowArtifact, FLOW_ARTIFACT);

  const session = harness.getSession(result.sessionId);
  assert.ok(session);
  assert.deepEqual(session.artifacts.flowArtifact, FLOW_ARTIFACT);
});

test('reuses an existing flow artifact and does not call the skill again', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
  });

  const first = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
  });
  assert.equal(spies.counts.flowGeneration, 1);

  await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    sessionId: first.sessionId,
  });
  assert.equal(spies.counts.flowGeneration, 1);
});

test('the flow skill receives only the change explanation, never the raw diff', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
  });

  await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
  });

  const flowInput = spies.getLastFlowInput();
  assert.ok(flowInput);
  assert.deepEqual(Object.keys(flowInput), ['changeExplanation']);
  assert.equal('rawDiff' in flowInput, false);
});

test('can skip the optional flow generation step', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
  });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    includeFlow: false,
  });

  assert.equal(spies.counts.flowGeneration, 0);
  assert.equal(result.flowArtifact, undefined);
});

test('does not generate a PR description by default', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    prDescription: spies.prDescription,
  });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
  });

  assert.equal(spies.counts.prDescription, 0);
  assert.equal(result.prDescription, undefined);
});

test('stores the PR description as a session artifact and in the result when requested', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    prDescription: spies.prDescription,
  });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    includePrDescription: true,
  });

  assert.deepEqual(result.prDescription, PR_DESCRIPTION);

  const session = harness.getSession(result.sessionId);
  assert.ok(session);
  assert.deepEqual(session.artifacts.prDescription, PR_DESCRIPTION);
});

test('reuses an existing PR description and does not call the skill again', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    prDescription: spies.prDescription,
  });

  const first = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    includePrDescription: true,
  });
  assert.equal(spies.counts.prDescription, 1);

  await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    sessionId: first.sessionId,
    includePrDescription: true,
  });
  assert.equal(spies.counts.prDescription, 1);
});

test('the PR description skill receives the four artifacts, never the raw diff', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    prDescription: spies.prDescription,
  });

  await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    includePrDescription: true,
  });

  const prInput = spies.getLastPrInput();
  assert.ok(prInput);
  assert.deepEqual(Object.keys(prInput).sort(), [
    'changeExplanation',
    'flowArtifact',
    'gapReport',
    'requirementAlignment',
  ]);
  assert.equal('rawDiff' in prInput, false);
});

test('does not generate a daily update by default', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    prDescription: spies.prDescription,
    dailyUpdate: spies.dailyUpdate,
  });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
  });

  assert.equal(spies.counts.dailyUpdate, 0);
  assert.equal(result.dailyUpdate, undefined);
});

test('stores the daily update as a session artifact and in the result when requested', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    prDescription: spies.prDescription,
    dailyUpdate: spies.dailyUpdate,
  });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    includePrDescription: true,
    includeDailyUpdate: true,
  });

  assert.deepEqual(result.dailyUpdate, DAILY_UPDATE);

  const session = harness.getSession(result.sessionId);
  assert.ok(session);
  assert.deepEqual(session.artifacts.dailyUpdate, DAILY_UPDATE);
});

test('reuses an existing daily update and does not call the skill again', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    prDescription: spies.prDescription,
    dailyUpdate: spies.dailyUpdate,
  });

  const first = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    includePrDescription: true,
    includeDailyUpdate: true,
  });
  assert.equal(spies.counts.dailyUpdate, 1);

  await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    sessionId: first.sessionId,
    includePrDescription: true,
    includeDailyUpdate: true,
  });
  assert.equal(spies.counts.dailyUpdate, 1);
});

test('the daily update skill receives the five artifacts, never the raw diff', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    prDescription: spies.prDescription,
    dailyUpdate: spies.dailyUpdate,
  });

  await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    includePrDescription: true,
    includeDailyUpdate: true,
  });

  const dailyInput = spies.getLastDailyUpdateInput();
  assert.ok(dailyInput);
  assert.deepEqual(Object.keys(dailyInput).sort(), [
    'changeExplanation',
    'flowArtifact',
    'gapReport',
    'prDescription',
    'requirementAlignment',
  ]);
  assert.equal('rawDiff' in dailyInput, false);
});

test('does not generate daily work guidance by default', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    dailyWorkGuidance: spies.dailyWorkGuidance,
  });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
  });

  assert.equal(spies.counts.dailyWorkGuidance, 0);
  assert.equal(result.dailyWorkGuidance, undefined);
});

test('stores daily work guidance as a session artifact and in the result when requested', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    dailyWorkGuidance: spies.dailyWorkGuidance,
  });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    includeDailyWorkGuidance: true,
  });

  assert.deepEqual(result.dailyWorkGuidance, DAILY_WORK_GUIDANCE);

  const session = harness.getSession(result.sessionId);
  assert.ok(session);
  assert.deepEqual(session.artifacts.dailyWorkGuidance, DAILY_WORK_GUIDANCE);
});

test('daily work guidance receives the spec, optional memory/goal, and artifacts, never the raw diff', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    dailyWorkGuidance: spies.dailyWorkGuidance,
  });

  await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    previousProgressMemory: 'Yesterday: scaffolding only.',
    todayGoal: 'Finish the planning stage today.',
    includeDailyWorkGuidance: true,
  });

  const guidanceInput = spies.getLastDailyWorkGuidanceInput();
  assert.ok(guidanceInput);
  assert.deepEqual(Object.keys(guidanceInput).sort(), [
    'changeExplanation',
    'date',
    'flowArtifact',
    'gapReport',
    'previousProgressMemory',
    'requirementAlignment',
    'specOrChecklist',
    'todayGoal',
  ]);
  assert.equal(guidanceInput.specOrChecklist, 'Add a planning stage before execution.');
  assert.match(guidanceInput.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(guidanceInput.previousProgressMemory, 'Yesterday: scaffolding only.');
  assert.equal(guidanceInput.todayGoal, 'Finish the planning stage today.');
  assert.equal('rawDiff' in guidanceInput, false);
});

test('daily work guidance omits optional memory/goal when they are not provided', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    dailyWorkGuidance: spies.dailyWorkGuidance,
  });

  await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    includeDailyWorkGuidance: true,
  });

  const guidanceInput = spies.getLastDailyWorkGuidanceInput();
  assert.ok(guidanceInput);
  assert.equal('previousProgressMemory' in guidanceInput, false);
  assert.equal('todayGoal' in guidanceInput, false);
});

test('does not generate a technical change brief by default', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    technicalChangeBrief: spies.technicalChangeBrief,
  });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
  });

  assert.equal(spies.counts.technicalChangeBrief, 0);
  assert.equal(result.technicalChangeBrief, undefined);
});

test('stores the technical change brief as a session artifact and in the result when requested', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    technicalChangeBrief: spies.technicalChangeBrief,
  });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    includeTechnicalChangeBrief: true,
  });

  assert.deepEqual(result.technicalChangeBrief, TECHNICAL_CHANGE_BRIEF);

  const session = harness.getSession(result.sessionId);
  assert.ok(session);
  assert.deepEqual(session.artifacts.technicalChangeBrief, TECHNICAL_CHANGE_BRIEF);
});

test('the technical change brief skill receives the raw diff, requirement, and available artifacts', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    technicalChangeBrief: spies.technicalChangeBrief,
  });

  await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    includeTechnicalChangeBrief: true,
  });

  const briefInput = spies.getLastTechnicalChangeBriefInput();
  assert.ok(briefInput);
  // Unlike the downstream skills, this one DOES receive the raw diff.
  assert.equal(briefInput.rawDiff, 'diff --git a b');
  assert.equal(briefInput.requirementText, 'Add a planning stage before execution.');
  assert.deepEqual(briefInput.changeExplanation, CHANGE_EXPLANATION);
  assert.deepEqual(briefInput.requirementAlignment, REQUIREMENT_ALIGNMENT);
  // Flow and gap report ran by default, so they are passed opportunistically.
  assert.deepEqual(briefInput.gapReport, GAP_REPORT);
  assert.deepEqual(briefInput.flowArtifact, FLOW_ARTIFACT);
});

test('the technical change brief runs with just the base analysis (flow and gap disabled)', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    technicalChangeBrief: spies.technicalChangeBrief,
  });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    includeFlow: false,
    includeGapReport: false,
    includeTechnicalChangeBrief: true,
  });

  assert.equal(spies.counts.technicalChangeBrief, 1);
  assert.deepEqual(result.technicalChangeBrief, TECHNICAL_CHANGE_BRIEF);

  const briefInput = spies.getLastTechnicalChangeBriefInput();
  assert.ok(briefInput);
  assert.equal('gapReport' in briefInput, false);
  assert.equal('flowArtifact' in briefInput, false);
});

test('reuses an existing technical change brief and does not call the skill again', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    technicalChangeBrief: spies.technicalChangeBrief,
  });

  const first = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    includeTechnicalChangeBrief: true,
  });
  assert.equal(spies.counts.technicalChangeBrief, 1);

  await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    sessionId: first.sessionId,
    includeTechnicalChangeBrief: true,
  });
  assert.equal(spies.counts.technicalChangeBrief, 1);
});

test('does not generate a demo prep loop by default', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    demoPrepLoop: spies.demoPrepLoop,
  });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
  });

  assert.equal(spies.counts.demoPrepLoop, 0);
  assert.equal(result.demoPrepLoop, undefined);
});

test('stores the demo prep loop as a session artifact and in the result when requested', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    demoPrepLoop: spies.demoPrepLoop,
  });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    includeDemoPrepLoop: true,
  });

  assert.deepEqual(result.demoPrepLoop, DEMO_PREP_LOOP);

  const session = harness.getSession(result.sessionId);
  assert.ok(session);
  assert.deepEqual(session.artifacts.demoPrepLoop, DEMO_PREP_LOOP);
});

test('the demo prep loop skill receives the raw diff, requirement, and available artifacts', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    technicalChangeBrief: spies.technicalChangeBrief,
    demoPrepLoop: spies.demoPrepLoop,
  });

  await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    includeTechnicalChangeBrief: true,
    includeDemoPrepLoop: true,
  });

  const loopInput = spies.getLastDemoPrepLoopInput();
  assert.ok(loopInput);
  // Like the technical change brief, this one DOES receive the raw diff.
  assert.equal(loopInput.rawDiff, 'diff --git a b');
  assert.equal(loopInput.requirementText, 'Add a planning stage before execution.');
  assert.deepEqual(loopInput.changeExplanation, CHANGE_EXPLANATION);
  assert.deepEqual(loopInput.requirementAlignment, REQUIREMENT_ALIGNMENT);
  // Flow, gap report, and the technical change brief ran, so they are passed
  // opportunistically — the brief in particular seeds the demo plan.
  assert.deepEqual(loopInput.gapReport, GAP_REPORT);
  assert.deepEqual(loopInput.flowArtifact, FLOW_ARTIFACT);
  assert.deepEqual(loopInput.technicalChangeBrief, TECHNICAL_CHANGE_BRIEF);
});

test('the demo prep loop runs with just the base analysis (flow and gap disabled)', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    demoPrepLoop: spies.demoPrepLoop,
  });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    includeFlow: false,
    includeGapReport: false,
    includeDemoPrepLoop: true,
  });

  assert.equal(spies.counts.demoPrepLoop, 1);
  assert.deepEqual(result.demoPrepLoop, DEMO_PREP_LOOP);

  const loopInput = spies.getLastDemoPrepLoopInput();
  assert.ok(loopInput);
  assert.equal('gapReport' in loopInput, false);
  assert.equal('flowArtifact' in loopInput, false);
  assert.equal('dailyWorkGuidance' in loopInput, false);
  assert.equal('technicalChangeBrief' in loopInput, false);
  assert.equal('videoScript' in loopInput, false);
});

test('reuses an existing demo prep loop and does not call the skill again', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    demoPrepLoop: spies.demoPrepLoop,
  });

  const first = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    includeDemoPrepLoop: true,
  });
  assert.equal(spies.counts.demoPrepLoop, 1);

  await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    sessionId: first.sessionId,
    includeDemoPrepLoop: true,
  });
  assert.equal(spies.counts.demoPrepLoop, 1);
});

test('does not generate a weekly review by default', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    weeklyReview: spies.weeklyReview,
  });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
  });

  assert.equal(spies.counts.weeklyReview, 0);
  assert.equal(result.weeklyReview, undefined);
});

test('stores the weekly review as a session artifact and in the result when requested', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    weeklyReview: spies.weeklyReview,
  });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    includeWeeklyReview: true,
  });

  assert.deepEqual(result.weeklyReview, WEEKLY_REVIEW);
  const session = harness.getSession(result.sessionId);
  assert.ok(session);
  assert.deepEqual(session.artifacts.weeklyReview, WEEKLY_REVIEW);
});

test('the weekly review consumes available daily/technical/demo artifacts and memory', async () => {
  const spies = makeSpies();
  const memoryStore = new InMemoryMemoryStore();
  await memoryStore.saveProjectMemory({
    userId: 'local',
    projectId: 'demo',
    memory: {
      schemaVersion: 1,
      userId: 'local',
      projectId: 'demo',
      latestSnapshot: {
        date: '2026-06-30',
        dailySummary: 'Last week: scaffolding only.',
        updatedChecklistStatuses: [],
        openBlockers: [],
        openDecisions: [],
        nextActions: [],
      },
      history: [],
      updatedAt: '2026-06-30T00:00:00.000Z',
    },
  });
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    dailyWorkGuidance: spies.dailyWorkGuidance,
    technicalChangeBrief: spies.technicalChangeBrief,
    demoPrepLoop: spies.demoPrepLoop,
    weeklyReview: spies.weeklyReview,
    memoryStore,
  });

  await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    projectId: 'demo',
    includeDailyWorkGuidance: true,
    includeTechnicalChangeBrief: true,
    includeDemoPrepLoop: true,
    includeWeeklyReview: true,
  });

  const input = spies.getLastWeeklyReviewInput();
  assert.ok(input);
  assert.equal(input.rawDiff, 'diff --git a b');
  assert.deepEqual(input.technicalChangeBrief, TECHNICAL_CHANGE_BRIEF);
  assert.deepEqual(input.demoPrepLoop, DEMO_PREP_LOOP);
  assert.ok(input.dailyWorkGuidance);
  assert.ok(input.previousProgressMemory);
  assert.match(input.previousProgressMemory, /scaffolding only/);
});

test('the weekly review runs with just the base analysis (no daily/technical/demo)', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    weeklyReview: spies.weeklyReview,
  });

  await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    includeFlow: false,
    includeGapReport: false,
    includeWeeklyReview: true,
  });

  const input = spies.getLastWeeklyReviewInput();
  assert.ok(input);
  assert.equal('dailyWorkGuidance' in input, false);
  assert.equal('technicalChangeBrief' in input, false);
  assert.equal('demoPrepLoop' in input, false);
  assert.equal('gapReport' in input, false);
});

test('saveProjectMemoryFromWeeklyReview persists the weekly memory proposal', async () => {
  const spies = makeSpies();
  const memoryStore = new InMemoryMemoryStore();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    weeklyReview: spies.weeklyReview,
    memoryStore,
  });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    includeWeeklyReview: true,
  });
  assert.ok(result.weeklyReview);

  await harness.saveProjectMemoryFromWeeklyReview({
    projectId: 'demo',
    weeklyReview: result.weeklyReview,
  });

  const stored = await harness.getProjectMemory({ projectId: 'demo' });
  assert.ok(stored?.latestSnapshot);
  assert.equal(stored.latestSnapshot.dailySummary, 'Planning stage done; ready to open PR.');
});

/** A fake GitInputAdapter that records its input and returns a fixed diff. */
function makeGitSpy() {
  let lastInput: GitInputAdapterInput | undefined;
  const adapter: GitInputAdapter = {
    name: 'spy-git-input',
    async execute(input: GitInputAdapterInput) {
      lastInput = input;
      return {
        rawDiff: 'diff --git a b',
        changedFiles: ['file.ts'],
        stats: { filesChanged: 1, additions: 1, deletions: 0 },
        requirementText: input.requirementText,
        source: 'git' as const,
      };
    },
  };
  return { adapter, getLastInput: () => lastInput };
}

test('runAnalysisFromGit reads git input then delegates into the analysis workflow', async () => {
  const spies = makeSpies();
  const git = makeGitSpy();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    gitInputAdapter: git.adapter,
  });

  const result = await harness.runAnalysisFromGit({
    repoPath: '/repo',
    baseRef: 'main',
    headRef: 'feature',
    requirementText: 'Add a planning stage before execution.',
  });

  assert.deepEqual(git.getLastInput(), {
    repoPath: '/repo',
    baseRef: 'main',
    headRef: 'feature',
    requirementText: 'Add a planning stage before execution.',
  });

  assert.deepEqual(spies.order, [
    'changeExplanation',
    'flowGeneration',
    'requirementAlignment',
    'gapReport',
  ]);
  assert.equal(result.changeExplanation.changeStory, CHANGE_EXPLANATION.changeStory);
  assert.ok(result.requirementInput);
});

test('runAnalysisFromGit forwards include flags into the workflow', async () => {
  const spies = makeSpies();
  const git = makeGitSpy();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    prDescription: spies.prDescription,
    dailyUpdate: spies.dailyUpdate,
    gitInputAdapter: git.adapter,
  });

  const result = await harness.runAnalysisFromGit({
    repoPath: '/repo',
    requirementText: 'Add a planning stage before execution.',
    includePrDescription: true,
  });

  assert.equal(spies.counts.prDescription, 1);
  assert.deepEqual(result.prDescription, PR_DESCRIPTION);
  assert.equal(result.dailyUpdate, undefined);
});

test('runAnalysisFromGit forwards a disabled optional step', async () => {
  const spies = makeSpies();
  const git = makeGitSpy();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    gitInputAdapter: git.adapter,
  });

  const result = await harness.runAnalysisFromGit({
    repoPath: '/repo',
    requirementText: 'Add a planning stage before execution.',
    includeFlow: false,
  });

  assert.equal(spies.counts.flowGeneration, 0);
  assert.equal(result.flowArtifact, undefined);
});

test('runAnalysisFromNotion turns rawText into the requirement and delegates to runAnalysis', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
  });

  const result = await harness.runAnalysisFromNotion({
    rawDiff: 'diff --git a b',
    rawText: 'Add a planning stage before execution.',
    notionPageId: 'page-1',
  });

  assert.deepEqual(spies.order, [
    'changeExplanation',
    'flowGeneration',
    'requirementAlignment',
    'gapReport',
  ]);
  assert.equal(
    spies.getLastAlignmentInput()?.requirementText,
    'Add a planning stage before execution.',
  );
  assert.ok(result.changeExplanation);
});

test('writeAnalysisToNotion formats selected artifacts read from the session', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
  });

  const analysis = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
  });

  const written = await harness.writeAnalysisToNotion({
    sessionId: analysis.sessionId,
    notionPageId: 'page-1',
    include: { changeExplanation: true, gapReport: true },
  });

  assert.equal(written.source, 'notion');
  assert.deepEqual(written.destination, { pageId: 'page-1' });
  assert.deepEqual(written.writtenSections, ['changeExplanation', 'gapReport']);
  assert.ok(written.content.includes('## Change Explanation'));
});

test('writeAnalysisToNotion writes every present artifact when include is omitted', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
  });

  const analysis = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
  });

  const written = await harness.writeAnalysisToNotion({ sessionId: analysis.sessionId });

  assert.deepEqual(written.writtenSections, [
    'changeExplanation',
    'requirementAlignment',
    'gapReport',
    'flowArtifact',
  ]);
});

test('writeAnalysisToNotion fails clearly when a requested artifact is missing', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
  });

  const analysis = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    includePrDescription: false,
  });

  await assert.rejects(
    () =>
      harness.writeAnalysisToNotion({
        sessionId: analysis.sessionId,
        include: { prDescription: true },
      }),
    /prDescription/,
  );
});

test('writeAnalysisToNotion does not run skills for missing artifacts', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    prDescription: spies.prDescription,
  });

  const analysis = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
  });

  await harness.writeAnalysisToNotion({ sessionId: analysis.sessionId });

  assert.equal(spies.counts.prDescription, 0);
});

test('does not generate a video script by default', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    videoScript: spies.videoScript,
  });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
  });

  assert.equal(spies.counts.videoScript, 0);
  assert.equal(result.videoScript, undefined);
});

test('stores the video script as a session artifact and in the result when requested', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    videoScript: spies.videoScript,
  });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    includeVideoScript: true,
  });

  assert.equal(spies.counts.videoScript, 1);
  assert.deepEqual(result.videoScript, VIDEO_SCRIPT);

  const session = harness.getSession(result.sessionId);
  assert.ok(session);
  assert.deepEqual(session.artifacts.videoScript, VIDEO_SCRIPT);
});

test('the video script skill receives the four artifacts, never the raw diff', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    videoScript: spies.videoScript,
  });

  await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    includeVideoScript: true,
  });

  const videoInput = spies.getLastVideoScriptInput();
  assert.ok(videoInput);
  assert.deepEqual(Object.keys(videoInput).sort(), [
    'changeExplanation',
    'flowArtifact',
    'gapReport',
    'requirementAlignment',
  ]);
  assert.equal('rawDiff' in videoInput, false);
});

test('writeAnalysisToNotion can format the video script when present', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    videoScript: spies.videoScript,
  });

  const analysis = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    includeVideoScript: true,
  });

  const written = await harness.writeAnalysisToNotion({
    sessionId: analysis.sessionId,
    include: { videoScript: true },
  });

  assert.deepEqual(written.writtenSections, ['videoScript']);
});

test('rejects includePrDescription when includeFlow is disabled, before any skill runs', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    prDescription: spies.prDescription,
  });

  await assert.rejects(
    () =>
      harness.runAnalysis({
        rawDiff: 'diff --git a b',
        requirementText: 'Add a planning stage before execution.',
        includeFlow: false,
        includePrDescription: true,
      }),
    /includePrDescription requires includeFlow/,
  );

  assert.equal(spies.counts.changeExplanation, 0);
  assert.equal(spies.counts.prDescription, 0);
});

test('rejects includeVideoScript when includeGapReport is disabled', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    videoScript: spies.videoScript,
  });

  await assert.rejects(
    () =>
      harness.runAnalysis({
        rawDiff: 'diff --git a b',
        requirementText: 'Add a planning stage before execution.',
        includeGapReport: false,
        includeVideoScript: true,
      }),
    /includeVideoScript requires includeGapReport/,
  );

  assert.equal(spies.counts.videoScript, 0);
});

test('rejects includeDailyUpdate when includePrDescription is disabled', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    prDescription: spies.prDescription,
    dailyUpdate: spies.dailyUpdate,
  });

  await assert.rejects(
    () =>
      harness.runAnalysis({
        rawDiff: 'diff --git a b',
        requirementText: 'Add a planning stage before execution.',
        includeDailyUpdate: true,
      }),
    /includeDailyUpdate requires includePrDescription/,
  );

  assert.equal(spies.counts.dailyUpdate, 0);
});

test('allows a downstream artifact when its prerequisites use the enabled defaults', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    videoScript: spies.videoScript,
  });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    includeVideoScript: true,
  });

  assert.deepEqual(result.videoScript, VIDEO_SCRIPT);
});

test('the workflow definition order matches the actual execution order', async () => {
  const spies = makeSpies();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    videoScript: spies.videoScript,
    prDescription: spies.prDescription,
    dailyUpdate: spies.dailyUpdate,
    dailyWorkGuidance: spies.dailyWorkGuidance,
    technicalChangeBrief: spies.technicalChangeBrief,
    demoPrepLoop: spies.demoPrepLoop,
    weeklyReview: spies.weeklyReview,
  });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    includeFlow: true,
    includeGapReport: true,
    includeVideoScript: true,
    includePrDescription: true,
    includeDailyUpdate: true,
    includeDailyWorkGuidance: true,
    includeTechnicalChangeBrief: true,
    includeDemoPrepLoop: true,
    includeWeeklyReview: true,
  });

  const session = harness.getSession(result.sessionId);
  assert.ok(session);
  assert.deepEqual(
    session.status.completedSteps,
    ANALYZE_CODE_CHANGE_WORKFLOW.map((step) => step.name),
  );
});

test('runAnalysisFromGit surfaces an invalid include-flag combination', async () => {
  const spies = makeSpies();
  const git = makeGitSpy();
  const harness = new AnalysisHarness({
    changeExplanation: spies.changeExplanation,
    flowGeneration: spies.flowGeneration,
    requirementAlignment: spies.requirementAlignment,
    gapReport: spies.gapReport,
    prDescription: spies.prDescription,
    gitInputAdapter: git.adapter,
  });

  await assert.rejects(
    () =>
      harness.runAnalysisFromGit({
        repoPath: '/repo',
        requirementText: 'Add a planning stage before execution.',
        includeFlow: false,
        includePrDescription: true,
      }),
    /includePrDescription requires includeFlow/,
  );

  assert.equal(spies.counts.prDescription, 0);
});
