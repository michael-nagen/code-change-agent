import { test } from 'node:test';
import assert from 'node:assert/strict';

import { AnalysisHarness } from '../AnalysisHarness.js';
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
  };
  let lastAlignmentInput: RequirementAlignmentInput | undefined;
  let lastGapReportInput: GapReportInput | undefined;
  let lastFlowInput: FlowGenerationInput | undefined;
  let lastPrInput: PRDescriptionInput | undefined;
  let lastVideoScriptInput: VideoScriptInput | undefined;
  let lastDailyUpdateInput: DailyUpdateInput | undefined;

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
    getLastAlignmentInput: () => lastAlignmentInput,
    getLastGapReportInput: () => lastGapReportInput,
    getLastFlowInput: () => lastFlowInput,
    getLastPrInput: () => lastPrInput,
    getLastVideoScriptInput: () => lastVideoScriptInput,
    getLastDailyUpdateInput: () => lastDailyUpdateInput,
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
  });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
    includeFlow: true,
    includeGapReport: true,
    includeVideoScript: true,
    includePrDescription: true,
    includeDailyUpdate: true,
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
