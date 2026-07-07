import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DefaultArtifactEditSkill } from '../ArtifactEditSkill.js';
import { buildPrompt } from '../prompt.js';
import { SkillError } from '../../../errors/SkillError.js';
import { FakeLanguageModel } from '../../mocks/index.js';
import type { ArtifactEditInput } from '../types.js';
import type { ChangeExplanation } from '../../changeExplanation/index.js';
import type { RequirementAlignment } from '../../requirementAlignment/index.js';
import type { GapReport } from '../../gapReport/index.js';
import type { FlowArtifact } from '../../flowGeneration/index.js';
import type { PRDescription } from '../../prDescription/index.js';
import type { VideoScript } from '../../videoScript/index.js';
import type { DailyUpdate } from '../../dailyUpdate/index.js';

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

const GAP_REPORT: GapReport = {
  readiness: 'needs_changes',
  completedWork: ['Planning stage is present'],
  remainingGaps: ['Add integration tests'],
  partialItems: [],
  unclearItems: [],
  risks: ['SENTINEL_RISK: planning may regress execution latency'],
  recommendedNextActions: ['Add tests before merging'],
  prRecommendation: 'Add tests, then open the PR.',
};

const FLOW_ARTIFACT: FlowArtifact = {
  title: 'Planning flow',
  description: 'How planning precedes execution.',
  steps: ['Input', 'Plan', 'Execute'],
  mermaid: 'flowchart TD\n  A[Input] --> B[Plan] --> C[Execute]',
};

const PR_DESCRIPTION: PRDescription = {
  title: 'Add planning stage',
  summary: 'Introduces a planning stage before execution.',
  whatChanged: ['Planning before execution'],
  requirementCoverage: ['Satisfied: planning stage present'],
  featureFlow: 'The system plans, then executes.\n\n```mermaid\nflowchart TD\n  A-->B\n```',
  testingNotes: ['Test the planner output'],
  risksAndFollowUps: ['Watch execution latency'],
};

const VIDEO_SCRIPT: VideoScript = {
  title: 'Planning walkthrough',
  targetAudience: 'Developers',
  estimatedDuration: '~2 minutes',
  sections: [{ title: 'Intro', narration: 'We added planning.', visualCue: 'Show the planner' }],
  keyTakeaways: ['Planning precedes execution'],
};

const DAILY_UPDATE: DailyUpdate = {
  headline: 'Added a planning stage.',
  yesterdaySummary: ['Built the planner'],
  todaySuggestions: ['Add tests'],
  blockersOrRisks: ['Latency risk'],
  highlightedTopic: {
    title: 'Planning',
    explanation: 'Planning precedes execution.',
    whyItMatters: 'Improves predictability.',
  },
  spokenVersion: 'Yesterday I added a planning stage before execution.',
};

function prInput(): ArtifactEditInput {
  return {
    selectedArtifactKey: 'prDescription',
    selectedArtifact: PR_DESCRIPTION,
    userMessage: 'Make this PR shorter.',
    sessionContext: {
      changeExplanation: CHANGE_EXPLANATION,
      requirementAlignment: REQUIREMENT_ALIGNMENT,
      gapReport: GAP_REPORT,
      flowArtifact: FLOW_ARTIFACT,
      prDescription: PR_DESCRIPTION,
    },
  };
}

function editResponse(key: string, artifact: unknown): string {
  return JSON.stringify({
    assistantMessage: 'Done.',
    changeSummary: `Edited ${key}.`,
    updatedArtifact: artifact,
  });
}

test('calls the LanguageModel exactly once', async () => {
  const model = new FakeLanguageModel(editResponse('prDescription', PR_DESCRIPTION));
  const skill = new DefaultArtifactEditSkill(model);

  await skill.execute(prInput());

  assert.equal(model.calls.length, 1);
});

test('prompt includes the selected artifact', async () => {
  const model = new FakeLanguageModel(editResponse('prDescription', PR_DESCRIPTION));
  const skill = new DefaultArtifactEditSkill(model);

  await skill.execute(prInput());

  const prompt = model.calls[0]?.prompt ?? '';
  assert.match(prompt, /Add planning stage/);
  assert.match(prompt, /Introduces a planning stage before execution\./);
});

test('prompt includes relevant session context', async () => {
  const model = new FakeLanguageModel(editResponse('prDescription', PR_DESCRIPTION));
  const skill = new DefaultArtifactEditSkill(model);

  await skill.execute(prInput());

  const prompt = model.calls[0]?.prompt ?? '';
  // The gap report's risk should be available as read-only context.
  assert.match(prompt, /SENTINEL_RISK/);
  assert.match(prompt, /GAPREPORT/);
});

test('prompt does NOT include a raw diff', async () => {
  const model = new FakeLanguageModel(editResponse('prDescription', PR_DESCRIPTION));
  const skill = new DefaultArtifactEditSkill(model);

  await skill.execute(prInput());

  const prompt = model.calls[0]?.prompt ?? '';
  assert.doesNotMatch(prompt, /diff --git/);
  assert.doesNotMatch(prompt, /rawDiff/);
});

test('builds a prompt directly without a raw diff for video script', () => {
  const prompt = buildPrompt({
    selectedArtifactKey: 'videoScript',
    selectedArtifact: VIDEO_SCRIPT,
    userMessage: 'Make this suitable for a 2-minute video.',
    sessionContext: { changeExplanation: CHANGE_EXPLANATION, requirementAlignment: REQUIREMENT_ALIGNMENT },
  });
  assert.match(prompt, /Walkthrough Script/);
  assert.match(prompt, /Planning walkthrough/);
  assert.doesNotMatch(prompt, /diff --git/);
});

test('parses a valid updated PRDescription', async () => {
  const updated: PRDescription = { ...PR_DESCRIPTION, summary: 'Shorter summary.' };
  const model = new FakeLanguageModel(editResponse('prDescription', updated));
  const skill = new DefaultArtifactEditSkill(model);

  const result = await skill.execute(prInput());

  assert.equal(result.assistantMessage, 'Done.');
  assert.deepEqual(result.updatedArtifact, updated);
});

test('parses a valid updated DailyUpdate', async () => {
  const updated: DailyUpdate = { ...DAILY_UPDATE, headline: 'עדכון בעברית.' };
  const model = new FakeLanguageModel(editResponse('dailyUpdate', updated));
  const skill = new DefaultArtifactEditSkill(model);

  const result = await skill.execute({
    selectedArtifactKey: 'dailyUpdate',
    selectedArtifact: DAILY_UPDATE,
    userMessage: 'Rewrite this Daily Prep in Hebrew.',
    sessionContext: { changeExplanation: CHANGE_EXPLANATION, requirementAlignment: REQUIREMENT_ALIGNMENT },
  });

  assert.deepEqual(result.updatedArtifact, updated);
});

test('parses a valid updated VideoScript', async () => {
  const updated: VideoScript = { ...VIDEO_SCRIPT, estimatedDuration: '~2 minutes (tightened)' };
  const model = new FakeLanguageModel(editResponse('videoScript', updated));
  const skill = new DefaultArtifactEditSkill(model);

  const result = await skill.execute({
    selectedArtifactKey: 'videoScript',
    selectedArtifact: VIDEO_SCRIPT,
    userMessage: 'Make the Walkthrough Script suitable for a 2-minute video.',
    sessionContext: { changeExplanation: CHANGE_EXPLANATION, requirementAlignment: REQUIREMENT_ALIGNMENT },
  });

  assert.deepEqual(result.updatedArtifact, updated);
});

test('invalid JSON fails closed', async () => {
  const model = new FakeLanguageModel('not json at all');
  const skill = new DefaultArtifactEditSkill(model);

  await assert.rejects(() => skill.execute(prInput()), (err) => {
    assert.ok(err instanceof SkillError);
    assert.equal(err.code, 'INVALID_OUTPUT');
    return true;
  });
});

test('schema mismatch in updatedArtifact fails closed', async () => {
  const broken = { ...PR_DESCRIPTION } as Record<string, unknown>;
  delete broken['summary'];
  const model = new FakeLanguageModel(editResponse('prDescription', broken));
  const skill = new DefaultArtifactEditSkill(model);

  await assert.rejects(() => skill.execute(prInput()), (err) => {
    assert.ok(err instanceof SkillError);
    return true;
  });
});

test('missing top-level fields fail closed', async () => {
  const model = new FakeLanguageModel(JSON.stringify({ updatedArtifact: PR_DESCRIPTION }));
  const skill = new DefaultArtifactEditSkill(model);

  await assert.rejects(() => skill.execute(prInput()), (err) => {
    assert.ok(err instanceof SkillError);
    return true;
  });
});

test('updatedArtifact must match the selectedArtifactKey schema', async () => {
  // A VideoScript shape returned while editing prDescription must be rejected,
  // because the PR parser requires fields (summary, whatChanged, ...) it lacks.
  const model = new FakeLanguageModel(editResponse('prDescription', VIDEO_SCRIPT));
  const skill = new DefaultArtifactEditSkill(model);

  await assert.rejects(() => skill.execute(prInput()), (err) => {
    assert.ok(err instanceof SkillError);
    return true;
  });
});
