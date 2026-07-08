import { test } from 'node:test';
import assert from 'node:assert/strict';

import { AnalysisHarness } from '../AnalysisHarness.js';
import { MockNotionConnector, MockGitHubConnector } from '../../sources/index.js';
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

const REQUIREMENT_TEXT = 'Add a durable cache with a spec-defined eviction policy.';
const RAW_DIFF = 'diff --git a/cache.ts b/cache.ts\n+RAW_DIFF_SENTINEL';

const CHANGE_EXPLANATION = {
  changeStory: 'Adds a cache.',
  keyFunctionalities: [],
  flow: [],
  mainComponents: [],
  architecturalDecisions: [],
  impactAnalysis: [],
  uncertainties: [],
} as ChangeExplanation;

const REQUIREMENT_ALIGNMENT = {
  requirementSummary: 'Add a cache',
  satisfiedItems: [],
  partiallySatisfiedItems: [],
  missingItems: [],
  unclearItems: [],
  overallAssessment: 'ok',
  confidence: 'high',
} as RequirementAlignment;

const FLOW_ARTIFACT = {
  title: 'Flow',
  description: 'desc',
  steps: [],
  mermaid: 'flowchart TD\n A',
} as FlowArtifact;

const GAP_REPORT = {
  readiness: 'unclear',
  completedWork: [],
  remainingGaps: [],
  partialItems: [],
  unclearItems: [],
  risks: [],
  recommendedNextActions: [],
  prRecommendation: 'n/a',
} as GapReport;

interface CapturedInputs {
  daily?: DailyWorkGuidanceInput;
  technical?: TechnicalChangeBriefInput;
  demo?: DemoPrepLoopInput;
  weekly?: WeeklyReviewInput;
}

function buildHarness(options: { withConnectors: boolean }): {
  harness: AnalysisHarness;
  captured: CapturedInputs;
} {
  const captured: CapturedInputs = {};

  const changeExplanation: ChangeExplanationSkill = {
    name: 'spy-change-explanation',
    async execute() {
      return structuredClone(CHANGE_EXPLANATION);
    },
  };
  const requirementAlignment: RequirementAlignmentSkill = {
    name: 'spy-requirement-alignment',
    async execute() {
      return structuredClone(REQUIREMENT_ALIGNMENT);
    },
  };
  const flowGeneration: FlowGenerationSkill = {
    name: 'spy-flow',
    async execute() {
      return structuredClone(FLOW_ARTIFACT);
    },
  };
  const gapReport: GapReportSkill = {
    name: 'spy-gap',
    async execute() {
      return structuredClone(GAP_REPORT);
    },
  };
  const dailyWorkGuidance: DailyWorkGuidanceSkill = {
    name: 'spy-daily',
    async execute(input) {
      captured.daily = input;
      return {} as DailyWorkGuidance;
    },
  };
  const technicalChangeBrief: TechnicalChangeBriefSkill = {
    name: 'spy-technical',
    async execute(input) {
      captured.technical = input;
      return {} as TechnicalChangeBrief;
    },
  };
  const demoPrepLoop: DemoPrepLoopSkill = {
    name: 'spy-demo',
    async execute(input) {
      captured.demo = input;
      return {} as DemoPrepLoop;
    },
  };
  const weeklyReview: WeeklyReviewSkill = {
    name: 'spy-weekly',
    async execute(input) {
      captured.weekly = input;
      return {} as WeeklyReview;
    },
  };

  const harness = new AnalysisHarness({
    changeExplanation,
    requirementAlignment,
    flowGeneration,
    gapReport,
    dailyWorkGuidance,
    technicalChangeBrief,
    demoPrepLoop,
    weeklyReview,
    ...(options.withConnectors
      ? {
          notionConnector: new MockNotionConnector('Notion spec text.'),
          githubConnector: new MockGitHubConnector(),
          sourceDefaults: {
            notionPageId: 'page-1',
            githubPrUrl: 'https://github.com/o/r/pull/1',
          },
        }
      : {}),
  });

  return { harness, captured };
}

async function runAll(harness: AnalysisHarness): Promise<void> {
  await harness.runAnalysis({
    rawDiff: RAW_DIFF,
    requirementText: REQUIREMENT_TEXT,
    includeFlow: true,
    includeGapReport: true,
    includeDailyWorkGuidance: true,
    includeTechnicalChangeBrief: true,
    includeDemoPrepLoop: true,
    includeWeeklyReview: true,
  });
}

test('all four narrative skills receive connected source context when connectors are configured', async () => {
  const { harness, captured } = buildHarness({ withConnectors: true });
  await runAll(harness);

  for (const [label, ctx] of [
    ['daily', captured.daily?.connectedSourceContext],
    ['technical', captured.technical?.connectedSourceContext],
    ['demo', captured.demo?.connectedSourceContext],
    ['weekly', captured.weekly?.connectedSourceContext],
  ] as const) {
    assert.ok(ctx, `expected ${label} to receive connected source context`);
    assert.match(ctx, /GitHub/, `${label} should mention the GitHub source`);
    assert.match(ctx, /Notion/, `${label} should mention the Notion source`);
    assert.match(ctx, /untrusted supporting context only/i, `${label} should be marked untrusted`);
  }
});

test('the explicit spec/diff remain the source of truth and are not duplicated as connected context', async () => {
  const { harness, captured } = buildHarness({ withConnectors: true });
  await runAll(harness);

  // Explicit inputs are still passed through unchanged.
  assert.equal(captured.daily?.specOrChecklist, REQUIREMENT_TEXT);
  assert.equal(captured.technical?.requirementText, REQUIREMENT_TEXT);
  assert.equal(captured.technical?.rawDiff, RAW_DIFF);
  assert.equal(captured.demo?.rawDiff, RAW_DIFF);
  assert.equal(captured.weekly?.rawDiff, RAW_DIFF);

  // The manual diff must never be re-presented inside the connected block.
  assert.doesNotMatch(captured.technical?.connectedSourceContext ?? '', /RAW_DIFF_SENTINEL/);
});

test('the manual flow is unchanged: no connectors means no connected source context', async () => {
  const { harness, captured } = buildHarness({ withConnectors: false });
  await runAll(harness);

  assert.equal(captured.daily?.connectedSourceContext, undefined);
  assert.equal(captured.technical?.connectedSourceContext, undefined);
  assert.equal(captured.demo?.connectedSourceContext, undefined);
  assert.equal(captured.weekly?.connectedSourceContext, undefined);
});

test('running analysis reads Notion but NEVER writes back (no auto-write on generation)', async () => {
  const notionConnector = new MockNotionConnector('Notion spec text.');
  const harness = new AnalysisHarness({
    changeExplanation: { name: 'ce', async execute() { return structuredClone(CHANGE_EXPLANATION); } },
    requirementAlignment: { name: 'ra', async execute() { return structuredClone(REQUIREMENT_ALIGNMENT); } },
    flowGeneration: { name: 'fg', async execute() { return structuredClone(FLOW_ARTIFACT); } },
    gapReport: { name: 'gr', async execute() { return structuredClone(GAP_REPORT); } },
    dailyWorkGuidance: { name: 'dg', async execute() { return {} as DailyWorkGuidance; } },
    demoPrepLoop: { name: 'dp', async execute() { return {} as DemoPrepLoop; } },
    weeklyReview: { name: 'wr', async execute() { return {} as WeeklyReview; } },
    notionConnector,
    sourceDefaults: { notionPageId: 'page-1' },
  });

  await harness.runAnalysis({
    rawDiff: RAW_DIFF,
    requirementText: REQUIREMENT_TEXT,
    includeFlow: true,
    includeGapReport: true,
    includeDailyWorkGuidance: true,
    includeDemoPrepLoop: true,
    includeWeeklyReview: true,
  });

  // The Notion page was read as supporting context, but nothing was appended.
  assert.equal(notionConnector.appended.length, 0);
});
