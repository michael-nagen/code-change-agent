import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DefaultGapReportSkill } from '../GapReportSkill.js';
import { SkillError } from '../../../errors/SkillError.js';
import { FakeLanguageModel } from '../../mocks/index.js';
import type { GapReport, GapReportInput } from '../types.js';
import type { ChangeExplanation } from '../../changeExplanation/index.js';
import type { RequirementAlignment } from '../../requirementAlignment/index.js';

const CHANGE_EXPLANATION: ChangeExplanation = {
  changeStory: 'Adds a planning stage before execution.',
  keyFunctionalities: ['Supports planning before execution'],
  flow: ['Input', 'Plan', 'Execute'],
  mainComponents: [{ name: 'Planner', responsibility: 'Builds a plan.' }],
  architecturalDecisions: ['Planning separated from execution'],
  impactAnalysis: ['Execution depends on planning'],
  uncertainties: ['Whether tests were added'],
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

const VALID_GAP_REPORT: GapReport = {
  readiness: 'ready',
  completedWork: ['Planning stage is present'],
  remainingGaps: [],
  partialItems: [],
  unclearItems: [],
  risks: ['Verify before merging: Whether tests were added'],
  recommendedNextActions: ['No blocking work remains — open the PR.'],
  prRecommendation: 'Ready to open a PR — no meaningful gaps detected.',
};

function input(): GapReportInput {
  return {
    changeExplanation: CHANGE_EXPLANATION,
    requirementAlignment: REQUIREMENT_ALIGNMENT,
  };
}

test('parses a valid JSON response into a structured GapReport', async () => {
  const model = new FakeLanguageModel(JSON.stringify(VALID_GAP_REPORT));
  const skill = new DefaultGapReportSkill(model);

  const report = await skill.execute(input());

  assert.deepEqual(report, VALID_GAP_REPORT);
});

test('calls the LanguageModel exactly once', async () => {
  const model = new FakeLanguageModel(JSON.stringify(VALID_GAP_REPORT));
  const skill = new DefaultGapReportSkill(model);

  await skill.execute(input());

  assert.equal(model.calls.length, 1);
});

test('the prompt includes the required input artifacts', async () => {
  const model = new FakeLanguageModel(JSON.stringify(VALID_GAP_REPORT));
  const skill = new DefaultGapReportSkill(model);

  await skill.execute(input());

  const prompt = model.calls[0]?.prompt ?? '';
  assert.ok(prompt.includes('Adds a planning stage before execution.'));
  assert.ok(prompt.includes('Planning stage is present'));
});

test('the prompt does not include a raw diff', async () => {
  const model = new FakeLanguageModel(JSON.stringify(VALID_GAP_REPORT));
  const skill = new DefaultGapReportSkill(model);

  await skill.execute(input());

  const prompt = model.calls[0]?.prompt ?? '';
  assert.equal(prompt.includes('diff --git'), false);
  assert.equal('rawDiff' in input(), false);
});

test('fails closed on invalid JSON', async () => {
  const model = new FakeLanguageModel('not json at all');
  const skill = new DefaultGapReportSkill(model);

  await assert.rejects(
    () => skill.execute(input()),
    (err: unknown) => err instanceof SkillError && err.code === 'INVALID_OUTPUT',
  );
});

test('fails closed on schema mismatch (invalid readiness enum)', async () => {
  const model = new FakeLanguageModel(
    JSON.stringify({ ...VALID_GAP_REPORT, readiness: 'totally-shippable' }),
  );
  const skill = new DefaultGapReportSkill(model);

  await assert.rejects(
    () => skill.execute(input()),
    (err: unknown) => err instanceof SkillError && err.code === 'INVALID_OUTPUT',
  );
});

test('fails closed on schema mismatch (missing field)', async () => {
  const incomplete: Partial<GapReport> = { ...VALID_GAP_REPORT };
  delete incomplete.prRecommendation;
  const model = new FakeLanguageModel(JSON.stringify(incomplete));
  const skill = new DefaultGapReportSkill(model);

  await assert.rejects(
    () => skill.execute(input()),
    (err: unknown) => err instanceof SkillError && err.code === 'INVALID_OUTPUT',
  );
});
