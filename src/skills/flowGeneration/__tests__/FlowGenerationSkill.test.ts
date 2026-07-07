import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DefaultFlowGenerationSkill } from '../FlowGenerationSkill.js';
import { SkillError } from '../../../errors/SkillError.js';
import { FakeLanguageModel } from '../../mocks/index.js';
import type { FlowArtifact, FlowGenerationInput } from '../types.js';
import type { ChangeExplanation } from '../../changeExplanation/index.js';

const CHANGE_EXPLANATION: ChangeExplanation = {
  changeStory: 'Adds a planning stage before execution.',
  keyFunctionalities: ['Supports planning before execution'],
  flow: ['Input received', 'Plan built', 'Execution'],
  mainComponents: [{ name: 'Planner', responsibility: 'Builds a plan.' }],
  architecturalDecisions: ['Planning separated from execution'],
  impactAnalysis: ['Execution depends on planning'],
  uncertainties: [],
};

const VALID_FLOW: FlowArtifact = {
  title: 'Planning — Runtime Flow',
  description: 'Shows how the change operates at runtime.',
  steps: ['Input received', 'Plan built', 'Execution'],
  mermaid: 'flowchart TD\n  S1["Input received"] --> S2["Plan built"]',
};

function input(): FlowGenerationInput {
  return { changeExplanation: CHANGE_EXPLANATION };
}

test('parses a valid JSON response into a structured FlowArtifact', async () => {
  const model = new FakeLanguageModel(JSON.stringify(VALID_FLOW));
  const skill = new DefaultFlowGenerationSkill(model);

  const artifact = await skill.execute(input());

  assert.deepEqual(artifact, VALID_FLOW);
});

test('calls the LanguageModel exactly once', async () => {
  const model = new FakeLanguageModel(JSON.stringify(VALID_FLOW));
  const skill = new DefaultFlowGenerationSkill(model);

  await skill.execute(input());

  assert.equal(model.calls.length, 1);
});

test('the prompt includes the change explanation', async () => {
  const model = new FakeLanguageModel(JSON.stringify(VALID_FLOW));
  const skill = new DefaultFlowGenerationSkill(model);

  await skill.execute(input());

  const prompt = model.calls[0]?.prompt ?? '';
  assert.ok(prompt.includes('Adds a planning stage before execution.'));
  assert.ok(prompt.includes('Plan built'));
});

test('the prompt does not include a raw diff', async () => {
  const model = new FakeLanguageModel(JSON.stringify(VALID_FLOW));
  const skill = new DefaultFlowGenerationSkill(model);

  await skill.execute(input());

  const prompt = model.calls[0]?.prompt ?? '';
  assert.equal(prompt.includes('diff --git'), false);
  assert.equal('rawDiff' in input(), false);
});

test('fails closed on invalid JSON', async () => {
  const model = new FakeLanguageModel('```not json```');
  const skill = new DefaultFlowGenerationSkill(model);

  await assert.rejects(
    () => skill.execute(input()),
    (err: unknown) => err instanceof SkillError && err.code === 'INVALID_OUTPUT',
  );
});

test('fails closed on schema mismatch (steps not an array)', async () => {
  const model = new FakeLanguageModel(JSON.stringify({ ...VALID_FLOW, steps: 'one then two' }));
  const skill = new DefaultFlowGenerationSkill(model);

  await assert.rejects(
    () => skill.execute(input()),
    (err: unknown) => err instanceof SkillError && err.code === 'INVALID_OUTPUT',
  );
});
