import { test } from 'node:test';
import assert from 'node:assert/strict';

import { AnalysisHarness } from '../AnalysisHarness.js';
import { InMemoryMemoryStore } from '../../memory/index.js';
import { MockNotionConnector, MockGitHubConnector } from '../../sources/index.js';
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

const CHANGE_EXPLANATION: ChangeExplanation = {
  changeStory: 'Adds a cache.',
  keyFunctionalities: ['Caches reads'],
  flow: ['read', 'store'],
  mainComponents: [{ name: 'Cache', responsibility: 'Holds values' }],
  architecturalDecisions: [],
  impactAnalysis: [],
  uncertainties: [],
};

const REQUIREMENT_ALIGNMENT: RequirementAlignment = {
  requirementSummary: 'Add a cache',
  satisfiedItems: [],
  partiallySatisfiedItems: [],
  missingItems: [],
  unclearItems: [],
  overallAssessment: 'ok',
  confidence: 'high',
};

function baseSkills() {
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
  return { changeExplanation, requirementAlignment };
}

test('the manual flow attaches a normalized context with no external sources by default', async () => {
  const harness = new AnalysisHarness({ ...baseSkills() });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a/c b/c',
    requirementText: 'Add a cache',
    includeFlow: false,
    includeGapReport: false,
  });

  assert.ok(result.projectContext);
  const kinds = result.projectContext.sources.map((s) => s.source.kind);
  assert.deepEqual(kinds, ['manual', 'manual']);
  assert.equal(result.projectContext.requirementText, 'Add a cache');
  assert.equal(result.projectContext.diffText, 'diff --git a/c b/c');
});

test('memory is represented as a normalized source when available', async () => {
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
        dailySummary: 'Yesterday: scaffolding only.',
        updatedChecklistStatuses: [],
        openBlockers: [],
        openDecisions: [],
        nextActions: [],
      },
      history: [],
      updatedAt: '2026-07-06T00:00:00.000Z',
    },
  });
  const harness = new AnalysisHarness({ ...baseSkills(), memoryStore });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a/c b/c',
    requirementText: 'Add a cache',
    projectId: 'demo',
    includeFlow: false,
    includeGapReport: false,
  });

  const memory = result.projectContext?.sources.find((s) => s.source.kind === 'memory');
  assert.ok(memory);
  assert.match(memory.text, /scaffolding only/);
});

test('configured connectors add external sources behind the scenes (via source defaults)', async () => {
  const harness = new AnalysisHarness({
    ...baseSkills(),
    notionConnector: new MockNotionConnector('Notion spec text.'),
    githubConnector: new MockGitHubConnector(),
    sourceDefaults: {
      notionPageId: 'page-1',
      githubPrUrl: 'https://github.com/o/r/pull/1',
    },
  });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a/c b/c',
    requirementText: 'Add a cache',
    includeFlow: false,
    includeGapReport: false,
  });

  const kinds = (result.projectContext?.sources ?? []).map((s) => s.source.kind).sort();
  assert.deepEqual(kinds, ['github', 'manual', 'manual', 'notion']);
  assert.match(result.projectContext?.sourceSummary ?? '', /Notion/);
  assert.match(result.projectContext?.sourceSummary ?? '', /GitHub/);
});

test('a per-run source id overrides the configured default', async () => {
  const notion = new MockNotionConnector('Notion spec text.');
  const harness = new AnalysisHarness({
    ...baseSkills(),
    notionConnector: notion,
    sourceDefaults: { notionPageId: 'default-page' },
  });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a/c b/c',
    requirementText: 'Add a cache',
    notionPageId: 'override-page',
    includeFlow: false,
    includeGapReport: false,
  });

  const notionSource = result.projectContext?.sources.find((s) => s.source.kind === 'notion');
  assert.ok(notionSource);
  assert.equal(notionSource.source.id, 'override-page');
});

test('a failing connector never breaks the run (manual flow preserved)', async () => {
  const harness = new AnalysisHarness({
    ...baseSkills(),
    githubConnector: {
      async readPullRequest() {
        throw new Error('network down');
      },
    },
    sourceDefaults: { githubPrUrl: 'https://github.com/o/r/pull/1' },
  });

  const result = await harness.runAnalysis({
    rawDiff: 'diff --git a/c b/c',
    requirementText: 'Add a cache',
    includeFlow: false,
    includeGapReport: false,
  });

  // The run succeeds; only the manual sources are present.
  assert.ok(result.projectContext);
  assert.deepEqual(
    result.projectContext.sources.map((s) => s.source.kind),
    ['manual', 'manual'],
  );
});
