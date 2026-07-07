import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DefaultPRDescriptionSkill } from '../PRDescriptionSkill.js';
import { SkillError } from '../../../errors/SkillError.js';
import { FakeLanguageModel } from '../../mocks/index.js';
import type { PRDescription, PRDescriptionInput } from '../types.js';
import type { ChangeExplanation } from '../../changeExplanation/index.js';
import type { RequirementAlignment } from '../../requirementAlignment/index.js';
import type { GapReport } from '../../gapReport/index.js';
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
  recommendedNextActions: ['No blocking work remains — open the PR.'],
  prRecommendation: 'Ready to open a PR — no meaningful gaps detected.',
};

const FLOW_ARTIFACT: FlowArtifact = {
  title: 'Planning — Runtime Flow',
  description: 'Shows how the change operates at runtime.',
  steps: ['Input received', 'Plan built', 'Execution'],
  mermaid: 'flowchart TD\n  S1["Input received"] --> S2["Plan built"]',
};

const VALID_PR: PRDescription = {
  title: 'Supports planning before execution',
  summary: 'Adds a planning stage. Readiness: ready.',
  whatChanged: ['Supports planning before execution'],
  requirementCoverage: ['Satisfied: Planning stage is present'],
  featureFlow: 'Runtime flow.\n\n```mermaid\nflowchart TD\n  S1["Input received"]\n```',
  testingNotes: ['No automated test results are included; run the test suite before merging.'],
  risksAndFollowUps: ['No blocking work remains — open the PR.'],
};

function input(): PRDescriptionInput {
  return {
    changeExplanation: CHANGE_EXPLANATION,
    requirementAlignment: REQUIREMENT_ALIGNMENT,
    gapReport: GAP_REPORT,
    flowArtifact: FLOW_ARTIFACT,
  };
}

test('parses a valid JSON response into a structured PRDescription', async () => {
  const model = new FakeLanguageModel(JSON.stringify(VALID_PR));
  const skill = new DefaultPRDescriptionSkill(model);

  const pr = await skill.execute(input());

  assert.deepEqual(pr, VALID_PR);
});

test('calls the LanguageModel exactly once', async () => {
  const model = new FakeLanguageModel(JSON.stringify(VALID_PR));
  const skill = new DefaultPRDescriptionSkill(model);

  await skill.execute(input());

  assert.equal(model.calls.length, 1);
});

test('the prompt includes all four required input artifacts', async () => {
  const model = new FakeLanguageModel(JSON.stringify(VALID_PR));
  const skill = new DefaultPRDescriptionSkill(model);

  await skill.execute(input());

  const prompt = model.calls[0]?.prompt ?? '';
  assert.ok(prompt.includes('Adds a planning stage before execution.'));
  assert.ok(prompt.includes('Planning stage is present'));
  assert.ok(prompt.includes('Ready to open a PR'));
  assert.ok(prompt.includes('Planning — Runtime Flow'));
});

test('the prompt does not include a raw diff', async () => {
  const model = new FakeLanguageModel(JSON.stringify(VALID_PR));
  const skill = new DefaultPRDescriptionSkill(model);

  await skill.execute(input());

  const prompt = model.calls[0]?.prompt ?? '';
  assert.equal(prompt.includes('diff --git'), false);
  assert.equal('rawDiff' in input(), false);
});

test('fails closed on invalid JSON', async () => {
  const model = new FakeLanguageModel('<<not json>>');
  const skill = new DefaultPRDescriptionSkill(model);

  await assert.rejects(
    () => skill.execute(input()),
    (err: unknown) => err instanceof SkillError && err.code === 'INVALID_OUTPUT',
  );
});

test('fails closed on schema mismatch (missing field)', async () => {
  const incomplete: Partial<PRDescription> = { ...VALID_PR };
  delete incomplete.title;
  const model = new FakeLanguageModel(JSON.stringify(incomplete));
  const skill = new DefaultPRDescriptionSkill(model);

  await assert.rejects(
    () => skill.execute(input()),
    (err: unknown) => err instanceof SkillError && err.code === 'INVALID_OUTPUT',
  );
});
