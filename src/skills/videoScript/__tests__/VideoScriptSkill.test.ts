import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DefaultVideoScriptSkill } from '../VideoScriptSkill.js';
import { SkillError } from '../../../errors/SkillError.js';
import { FakeLanguageModel } from '../../mocks/index.js';
import type { VideoScript, VideoScriptInput } from '../types.js';
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

const VALID_SCRIPT: VideoScript = {
  title: 'Planning before execution — walkthrough',
  targetAudience: 'Reviewing developers',
  estimatedDuration: '~90 seconds',
  sections: [
    {
      title: 'What changed',
      narration: 'We added a planning stage.',
      visualCue: 'Show the flow diagram.',
    },
  ],
  keyTakeaways: ['Ready to open a PR.'],
};

function input(): VideoScriptInput {
  return {
    changeExplanation: CHANGE_EXPLANATION,
    requirementAlignment: REQUIREMENT_ALIGNMENT,
    gapReport: GAP_REPORT,
    flowArtifact: FLOW_ARTIFACT,
  };
}

test('parses a valid JSON response into a structured VideoScript', async () => {
  const model = new FakeLanguageModel(JSON.stringify(VALID_SCRIPT));
  const skill = new DefaultVideoScriptSkill(model);

  const script = await skill.execute(input());

  assert.deepEqual(script, VALID_SCRIPT);
});

test('calls the LanguageModel exactly once', async () => {
  const model = new FakeLanguageModel(JSON.stringify(VALID_SCRIPT));
  const skill = new DefaultVideoScriptSkill(model);

  await skill.execute(input());

  assert.equal(model.calls.length, 1);
});

test('the prompt includes all four required input artifacts', async () => {
  const model = new FakeLanguageModel(JSON.stringify(VALID_SCRIPT));
  const skill = new DefaultVideoScriptSkill(model);

  await skill.execute(input());

  const prompt = model.calls[0]?.prompt ?? '';
  assert.ok(prompt.includes('Adds a planning stage before execution.'));
  assert.ok(prompt.includes('Planning stage is present'));
  assert.ok(prompt.includes('Ready to open a PR'));
  assert.ok(prompt.includes('Planning — Runtime Flow'));
});

test('the prompt does not include a raw diff', async () => {
  const model = new FakeLanguageModel(JSON.stringify(VALID_SCRIPT));
  const skill = new DefaultVideoScriptSkill(model);

  await skill.execute(input());

  const prompt = model.calls[0]?.prompt ?? '';
  assert.equal(prompt.includes('diff --git'), false);
  assert.equal('rawDiff' in input(), false);
});

test('fails closed on invalid JSON', async () => {
  const model = new FakeLanguageModel('nope');
  const skill = new DefaultVideoScriptSkill(model);

  await assert.rejects(
    () => skill.execute(input()),
    (err: unknown) => err instanceof SkillError && err.code === 'INVALID_OUTPUT',
  );
});

test('fails closed on schema mismatch (section missing narration)', async () => {
  const broken = {
    ...VALID_SCRIPT,
    sections: [{ title: 'What changed', visualCue: 'Show the flow diagram.' }],
  };
  const model = new FakeLanguageModel(JSON.stringify(broken));
  const skill = new DefaultVideoScriptSkill(model);

  await assert.rejects(
    () => skill.execute(input()),
    (err: unknown) => err instanceof SkillError && err.code === 'INVALID_OUTPUT',
  );
});
