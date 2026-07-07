import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DefaultDailyUpdateSkill } from '../DailyUpdateSkill.js';
import { SkillError } from '../../../errors/SkillError.js';
import { FakeLanguageModel } from '../../mocks/index.js';
import type { DailyUpdate, DailyUpdateInput } from '../types.js';
import type { ChangeExplanation } from '../../changeExplanation/index.js';
import type { RequirementAlignment } from '../../requirementAlignment/index.js';
import type { GapReport } from '../../gapReport/index.js';
import type { PRDescription } from '../../prDescription/index.js';
import type { FlowArtifact } from '../../flowGeneration/index.js';

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

const GAP_REPORT: GapReport = {
  readiness: 'ready',
  completedWork: ['Planning stage is present'],
  remainingGaps: [],
  partialItems: [],
  unclearItems: [],
  risks: [],
  recommendedNextActions: ['Open the PR.'],
  prRecommendation: 'Ready to open a PR — no meaningful gaps detected.',
};

const PR_DESCRIPTION: PRDescription = {
  title: 'Supports planning before execution',
  summary: 'Adds a planning stage.',
  whatChanged: ['Supports planning before execution'],
  requirementCoverage: ['Satisfied: Planning stage is present'],
  featureFlow: 'Flow.',
  testingNotes: ['Run the test suite before merging.'],
  risksAndFollowUps: [],
};

const FLOW_ARTIFACT: FlowArtifact = {
  title: 'Planning — Runtime Flow',
  description: 'Shows how the change operates at runtime.',
  steps: ['Input received', 'Plan built', 'Execution'],
  mermaid: 'flowchart TD\n  S1["Input received"] --> S2["Plan built"]',
};

const VALID_UPDATE: DailyUpdate = {
  headline: 'Planning before execution is ready.',
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

function input(): DailyUpdateInput {
  return {
    changeExplanation: CHANGE_EXPLANATION,
    requirementAlignment: REQUIREMENT_ALIGNMENT,
    gapReport: GAP_REPORT,
    prDescription: PR_DESCRIPTION,
    flowArtifact: FLOW_ARTIFACT,
  };
}

test('parses a valid JSON response into a structured DailyUpdate', async () => {
  const model = new FakeLanguageModel(JSON.stringify(VALID_UPDATE));
  const skill = new DefaultDailyUpdateSkill(model);

  const update = await skill.execute(input());

  assert.deepEqual(update, VALID_UPDATE);
});

test('calls the LanguageModel exactly once', async () => {
  const model = new FakeLanguageModel(JSON.stringify(VALID_UPDATE));
  const skill = new DefaultDailyUpdateSkill(model);

  await skill.execute(input());

  assert.equal(model.calls.length, 1);
});

test('the prompt includes all five required input artifacts', async () => {
  const model = new FakeLanguageModel(JSON.stringify(VALID_UPDATE));
  const skill = new DefaultDailyUpdateSkill(model);

  await skill.execute(input());

  const prompt = model.calls[0]?.prompt ?? '';
  assert.ok(prompt.includes('Adds a planning stage before execution.'));
  assert.ok(prompt.includes('Planning stage is present'));
  assert.ok(prompt.includes('Open the PR.'));
  assert.ok(prompt.includes('Supports planning before execution'));
  assert.ok(prompt.includes('Planning — Runtime Flow'));
});

test('the prompt does not include a raw diff', async () => {
  const model = new FakeLanguageModel(JSON.stringify(VALID_UPDATE));
  const skill = new DefaultDailyUpdateSkill(model);

  await skill.execute(input());

  const prompt = model.calls[0]?.prompt ?? '';
  assert.equal(prompt.includes('diff --git'), false);
  assert.equal('rawDiff' in input(), false);
});

test('fails closed on invalid JSON', async () => {
  const model = new FakeLanguageModel('still not json');
  const skill = new DefaultDailyUpdateSkill(model);

  await assert.rejects(
    () => skill.execute(input()),
    (err: unknown) => err instanceof SkillError && err.code === 'INVALID_OUTPUT',
  );
});

test('fails closed on schema mismatch (highlightedTopic missing whyItMatters)', async () => {
  const broken = {
    ...VALID_UPDATE,
    highlightedTopic: {
      title: 'Planning separated from execution',
      explanation: 'Planning is separated from execution.',
    },
  };
  const model = new FakeLanguageModel(JSON.stringify(broken));
  const skill = new DefaultDailyUpdateSkill(model);

  await assert.rejects(
    () => skill.execute(input()),
    (err: unknown) => err instanceof SkillError && err.code === 'INVALID_OUTPUT',
  );
});
