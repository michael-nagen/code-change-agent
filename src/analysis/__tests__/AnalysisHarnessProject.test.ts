import { test } from 'node:test';
import assert from 'node:assert/strict';

import { AnalysisHarness } from '../AnalysisHarness.js';
import { InMemoryProjectStore } from '../../project/index.js';
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

const FLOW_ARTIFACT: FlowArtifact = {
  title: 'Planning — Runtime Flow',
  description: 'Shows how the change operates at runtime.',
  steps: ['Input received', 'Plan built', 'Execution'],
  mermaid: 'flowchart TD\n  S1["Input received"] --> S2["Plan built"]',
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

/**
 * Default-pipeline skill doubles that use no LanguageModel. These cover the
 * steps the default include flags run (changeExplanation, flowGeneration,
 * requirementAlignment, gapReport) so the project-wiring assertions can focus on
 * session ownership rather than artifact content.
 */
function makeSkills() {
  const changeExplanation: ChangeExplanationSkill = {
    name: 'spy-change-explanation',
    async execute(_input: ChangeExplanationInput): Promise<ChangeExplanation> {
      return structuredClone(CHANGE_EXPLANATION);
    },
  };
  const requirementAlignment: RequirementAlignmentSkill = {
    name: 'spy-requirement-alignment',
    async execute(_input: RequirementAlignmentInput): Promise<RequirementAlignment> {
      return structuredClone(REQUIREMENT_ALIGNMENT);
    },
  };
  const flowGeneration: FlowGenerationSkill = {
    name: 'spy-flow-generation',
    async execute(_input: FlowGenerationInput): Promise<FlowArtifact> {
      return structuredClone(FLOW_ARTIFACT);
    },
  };
  const gapReport: GapReportSkill = {
    name: 'spy-gap-report',
    async execute(_input: GapReportInput): Promise<GapReport> {
      return structuredClone(GAP_REPORT);
    },
  };
  return { changeExplanation, requirementAlignment, flowGeneration, gapReport };
}

function makeGitSpy() {
  const adapter: GitInputAdapter = {
    name: 'spy-git-input',
    async execute(input: GitInputAdapterInput) {
      return {
        rawDiff: 'diff --git a b',
        changedFiles: ['file.ts'],
        stats: { filesChanged: 1, additions: 1, deletions: 0 },
        requirementText: input.requirementText,
        source: 'git' as const,
      };
    },
  };
  return { adapter };
}

test('runAnalysis with a projectId creates a session that carries the projectId', async () => {
  const projectStore = new InMemoryProjectStore();
  const project = projectStore.createProject({ name: 'Checkout service' });
  const harness = new AnalysisHarness({ ...makeSkills(), projectStore });

  const result = await harness.runAnalysis({
    projectId: project.projectId,
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
  });

  const session = harness.getSession(result.sessionId);
  assert.ok(session);
  assert.equal(session.projectId, project.projectId);
});

test('runAnalysis with a projectId attaches the session to the project', async () => {
  const projectStore = new InMemoryProjectStore();
  const project = projectStore.createProject({ name: 'Checkout service' });
  const harness = new AnalysisHarness({ ...makeSkills(), projectStore });

  const result = await harness.runAnalysis({
    projectId: project.projectId,
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
  });

  const stored = projectStore.getProject({ projectId: project.projectId });
  assert.ok(stored);
  assert.deepEqual(stored.sessions, [result.sessionId]);
});

test('runAnalysis without a projectId behaves exactly as before', async () => {
  const projectStore = new InMemoryProjectStore();
  const project = projectStore.createProject({ name: 'Checkout service' });
  const harness = new AnalysisHarness({ ...makeSkills(), projectStore });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
  });

  const session = harness.getSession(result.sessionId);
  assert.ok(session);
  assert.equal(session.projectId, undefined);

  const stored = projectStore.getProject({ projectId: project.projectId });
  assert.ok(stored);
  assert.deepEqual(stored.sessions, []);
});

test('runAnalysisFromGit preserves the projectId on the session and attaches it', async () => {
  const projectStore = new InMemoryProjectStore();
  const project = projectStore.createProject({ name: 'Checkout service' });
  const { adapter } = makeGitSpy();
  const harness = new AnalysisHarness({ ...makeSkills(), projectStore, gitInputAdapter: adapter });

  const result = await harness.runAnalysisFromGit({
    projectId: project.projectId,
    repoPath: '/repo',
    requirementText: 'Add a planning stage before execution.',
  });

  const session = harness.getSession(result.sessionId);
  assert.ok(session);
  assert.equal(session.projectId, project.projectId);

  const stored = projectStore.getProject({ projectId: project.projectId });
  assert.ok(stored);
  assert.deepEqual(stored.sessions, [result.sessionId]);
});

test('runAnalysisFromNotion preserves the projectId on the session and attaches it', async () => {
  const projectStore = new InMemoryProjectStore();
  const project = projectStore.createProject({ name: 'Checkout service' });
  const harness = new AnalysisHarness({ ...makeSkills(), projectStore });

  const result = await harness.runAnalysisFromNotion({
    projectId: project.projectId,
    rawDiff: 'diff --git a b',
    rawText: 'Add a planning stage before execution.',
    notionPageId: 'page-1',
  });

  const session = harness.getSession(result.sessionId);
  assert.ok(session);
  assert.equal(session.projectId, project.projectId);

  const stored = projectStore.getProject({ projectId: project.projectId });
  assert.ok(stored);
  assert.deepEqual(stored.sessions, [result.sessionId]);
});

test('does not auto-use project plugin defaults yet', async () => {
  // The project carries git/notion config, but the harness must not infer it:
  // an analysis run with a projectId still requires explicit inputs and the
  // configured repo/page are not consulted.
  const projectStore = new InMemoryProjectStore();
  const project = projectStore.createProject({
    name: 'Checkout service',
    plugins: { git: { repoPath: '/configured/repo' } },
    preferences: { includePrDescriptionByDefault: true },
  });
  const harness = new AnalysisHarness({ ...makeSkills(), projectStore });

  const result = await harness.runAnalysis({
    projectId: project.projectId,
    rawDiff: 'diff --git a b',
    requirementText: 'Add a planning stage before execution.',
  });

  // preferences.includePrDescriptionByDefault was NOT applied.
  assert.equal(result.prDescription, undefined);
});
