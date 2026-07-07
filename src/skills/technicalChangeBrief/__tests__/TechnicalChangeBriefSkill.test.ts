import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DefaultTechnicalChangeBriefSkill } from '../TechnicalChangeBriefSkill.js';
import { SkillError } from '../../../errors/SkillError.js';
import { FakeLanguageModel } from '../../mocks/index.js';
import type { TechnicalChangeBrief, TechnicalChangeBriefInput } from '../types.js';
import type { ChangeExplanation } from '../../changeExplanation/index.js';
import type { RequirementAlignment } from '../../requirementAlignment/index.js';
import type { GapReport } from '../../gapReport/index.js';
import type { FlowArtifact } from '../../flowGeneration/index.js';

const RAW_DIFF = [
  'diff --git a/src/cache.ts b/src/cache.ts',
  '+export interface CacheEntry { key: string; value: string; expiresAt: number; }',
].join('\n');

const REQUIREMENT_TEXT = 'Add an in-memory cache with a TTL.';

const CHANGE_EXPLANATION: ChangeExplanation = {
  changeStory: 'Adds an in-memory cache with a TTL.',
  keyFunctionalities: ['Caches reads with expiry'],
  flow: ['Read', 'Check cache', 'Store'],
  mainComponents: [{ name: 'Cache', responsibility: 'Holds cached values.' }],
  architecturalDecisions: ['In-memory map keyed by string'],
  impactAnalysis: ['Read path'],
  uncertainties: [],
};

const REQUIREMENT_ALIGNMENT: RequirementAlignment = {
  requirementSummary: 'Add an in-memory cache with a TTL.',
  satisfiedItems: ['Cache present', 'TTL present'],
  partiallySatisfiedItems: [],
  missingItems: [],
  unclearItems: [],
  overallAssessment: 'Implemented as described.',
  confidence: 'high',
};

const GAP_REPORT: GapReport = {
  readiness: 'ready',
  completedWork: ['Cache with TTL'],
  remainingGaps: [],
  partialItems: [],
  unclearItems: [],
  risks: [],
  recommendedNextActions: ['Open the PR.'],
  prRecommendation: 'Ready to open a PR.',
};

const FLOW_ARTIFACT: FlowArtifact = {
  title: 'Cache — Runtime Flow',
  description: 'How the cache behaves at runtime.',
  steps: ['Read', 'Check cache', 'Store'],
  mermaid: 'flowchart TD\n  A["Read"] --> B["Check cache"]',
};

const VALID_BRIEF: TechnicalChangeBrief = {
  executiveSummary: 'Adds an in-memory cache with a TTL to speed up reads.',
  dataSchemaChanges: {
    hasChanges: true,
    summary: 'A new CacheEntry shape was introduced.',
    newFields: [
      {
        name: 'expiresAt',
        filePath: 'src/cache.ts',
        description: 'Epoch ms when the entry expires.',
        evidence: 'confirmed',
      },
    ],
    changedFields: [],
    removedFields: [],
    newSchemas: [
      {
        name: 'CacheEntry',
        filePath: 'src/cache.ts',
        description: 'The stored cache record.',
        evidence: 'confirmed',
      },
    ],
    changedParserContracts: [],
    newStatusValues: [],
    persistedDataImpact: 'No persisted data is affected; the cache is in memory only.',
    backwardCompatibility: 'compatible',
    backwardCompatibilityNote: 'Purely additive; no existing shapes changed.',
  },
  modelsAndTypes: [
    {
      name: 'CacheEntry',
      filePath: 'src/cache.ts',
      represents: 'A single cached value with an expiry.',
      whyNeeded: 'To store values alongside their TTL.',
      importantFields: ['key: cache key', 'value: cached value', 'expiresAt: expiry time'],
      evidence: 'confirmed',
    },
  ],
  inputsApiFlags: [
    {
      name: 'includeCache',
      kind: 'includeFlag',
      description: 'Turns the cache on for a run.',
      evidence: 'inferred',
    },
  ],
  workflowRuntimeChanges: {
    summary: 'A cache lookup is inserted before the read path.',
    whereItRuns: 'At the start of the read path.',
    dependsOn: ['The read path'],
    consumesArtifacts: ['None'],
    producesArtifact: 'None',
    cachedOrReused: 'Values are reused until they expire.',
    behaviorWhenFlagOff: 'Reads go straight to the source.',
  },
  uiChanges: {
    hasChanges: false,
    summary: 'No UI changes in this diff.',
    newCardsOrViews: [],
    togglesOrButtons: [],
    copyActions: [],
    sectionsDisplayed: [],
    howToActivate: 'not visible from the provided diff/analysis',
  },
  interestingFunctionality: [
    {
      title: 'TTL expiry check',
      whatItDoes: 'Skips stale entries.',
      whyItMatters: 'Keeps cached data fresh.',
      howItWorks: 'Compares expiresAt against the current time on read.',
      filesInvolved: ['src/cache.ts'],
    },
  ],
  howItWorksStepByStep: [
    { actor: 'Caller', action: 'Requests a value.' },
    { action: 'Cache checks for a fresh entry.', detail: 'Compares expiresAt to now.' },
    { actor: 'Cache', action: 'Returns the cached value or stores a fresh one.' },
  ],
  filesWorthShowing: [
    {
      path: 'src/cache.ts',
      whyItMatters: 'It holds the cache and TTL logic.',
      whatToPointOut: 'The CacheEntry shape and the expiry check.',
    },
  ],
  talkingPoints: [
    'We added an in-memory cache with a TTL.',
    'It is additive and backward-compatible.',
  ],
};

function input(): TechnicalChangeBriefInput {
  return {
    rawDiff: RAW_DIFF,
    requirementText: REQUIREMENT_TEXT,
    changeExplanation: CHANGE_EXPLANATION,
    requirementAlignment: REQUIREMENT_ALIGNMENT,
    gapReport: GAP_REPORT,
    flowArtifact: FLOW_ARTIFACT,
  };
}

test('parses a valid JSON response into a structured TechnicalChangeBrief', async () => {
  const model = new FakeLanguageModel(JSON.stringify(VALID_BRIEF));
  const skill = new DefaultTechnicalChangeBriefSkill(model);

  const brief = await skill.execute(input());

  assert.deepEqual(brief, VALID_BRIEF);
});

test('calls the LanguageModel exactly once', async () => {
  const model = new FakeLanguageModel(JSON.stringify(VALID_BRIEF));
  const skill = new DefaultTechnicalChangeBriefSkill(model);

  await skill.execute(input());

  assert.equal(model.calls.length, 1);
});

test('tolerates a JSON response wrapped in markdown fences', async () => {
  const model = new FakeLanguageModel('```json\n' + JSON.stringify(VALID_BRIEF) + '\n```');
  const skill = new DefaultTechnicalChangeBriefSkill(model);

  const brief = await skill.execute(input());

  assert.deepEqual(brief, VALID_BRIEF);
});

test('the prompt includes the raw diff, the requirement, and the analysis artifacts', async () => {
  const model = new FakeLanguageModel(JSON.stringify(VALID_BRIEF));
  const skill = new DefaultTechnicalChangeBriefSkill(model);

  await skill.execute(input());

  const prompt = model.calls[0]?.prompt ?? '';
  assert.ok(prompt.includes('diff --git a/src/cache.ts'));
  assert.ok(prompt.includes(REQUIREMENT_TEXT));
  assert.ok(prompt.includes('Adds an in-memory cache with a TTL.'));
  assert.ok(prompt.includes('Cache — Runtime Flow'));
  // It must not present itself as a PR description or a reviewer-question tool.
  assert.ok(prompt.includes('NOT a PR description'));
  assert.ok(prompt.includes('NOT a reviewer-question generator'));
});

test('the prompt marks unavailable optional artifacts explicitly (no undefined leak)', async () => {
  const model = new FakeLanguageModel(JSON.stringify(VALID_BRIEF));
  const skill = new DefaultTechnicalChangeBriefSkill(model);

  const { gapReport: _g, flowArtifact: _f, ...rest } = input();
  await skill.execute(rest);

  const prompt = model.calls[0]?.prompt ?? '';
  assert.equal(prompt.includes('undefined'), false);
  assert.ok(prompt.includes('the gap report was not generated'));
  assert.ok(prompt.includes('the flow artifact was not generated'));
  assert.ok(prompt.includes('daily work guidance was not generated'));
});

test('handles empty/no-change sections explicitly', async () => {
  const model = new FakeLanguageModel(JSON.stringify(VALID_BRIEF));
  const skill = new DefaultTechnicalChangeBriefSkill(model);

  const brief = await skill.execute(input());

  assert.equal(brief.uiChanges.hasChanges, false);
  assert.deepEqual(brief.uiChanges.newCardsOrViews, []);
  assert.deepEqual(brief.dataSchemaChanges.changedFields, []);
});

test('separates confirmed implementation details from inferred impact', async () => {
  const model = new FakeLanguageModel(JSON.stringify(VALID_BRIEF));
  const skill = new DefaultTechnicalChangeBriefSkill(model);

  const brief = await skill.execute(input());

  assert.equal(brief.dataSchemaChanges.newSchemas[0]!.evidence, 'confirmed');
  assert.equal(brief.inputsApiFlags[0]!.evidence, 'inferred');
});

test('fails closed on invalid JSON', async () => {
  const model = new FakeLanguageModel('not json at all');
  const skill = new DefaultTechnicalChangeBriefSkill(model);

  await assert.rejects(
    () => skill.execute(input()),
    (err: unknown) => err instanceof SkillError && err.code === 'INVALID_OUTPUT',
  );
});

test('fails closed on an invalid evidence value', async () => {
  const broken = {
    ...VALID_BRIEF,
    modelsAndTypes: [{ ...VALID_BRIEF.modelsAndTypes[0], evidence: 'maybe' }],
  };
  const model = new FakeLanguageModel(JSON.stringify(broken));
  const skill = new DefaultTechnicalChangeBriefSkill(model);

  await assert.rejects(
    () => skill.execute(input()),
    (err: unknown) => err instanceof SkillError && err.code === 'INVALID_OUTPUT',
  );
});

test('fails closed on an invalid input/API kind', async () => {
  const broken = {
    ...VALID_BRIEF,
    inputsApiFlags: [{ ...VALID_BRIEF.inputsApiFlags[0], kind: 'webhook' }],
  };
  const model = new FakeLanguageModel(JSON.stringify(broken));
  const skill = new DefaultTechnicalChangeBriefSkill(model);

  await assert.rejects(
    () => skill.execute(input()),
    (err: unknown) => err instanceof SkillError && err.code === 'INVALID_OUTPUT',
  );
});

test('fails closed when dataSchemaChanges.hasChanges is missing', async () => {
  const { hasChanges: _h, ...withoutHasChanges } = VALID_BRIEF.dataSchemaChanges;
  const broken = { ...VALID_BRIEF, dataSchemaChanges: withoutHasChanges };
  const model = new FakeLanguageModel(JSON.stringify(broken));
  const skill = new DefaultTechnicalChangeBriefSkill(model);

  await assert.rejects(
    () => skill.execute(input()),
    (err: unknown) => err instanceof SkillError && err.code === 'INVALID_OUTPUT',
  );
});

test('fails closed when a required section is missing (workflowRuntimeChanges)', async () => {
  const { workflowRuntimeChanges: _w, ...withoutWorkflow } = VALID_BRIEF;
  const model = new FakeLanguageModel(JSON.stringify(withoutWorkflow));
  const skill = new DefaultTechnicalChangeBriefSkill(model);

  await assert.rejects(
    () => skill.execute(input()),
    (err: unknown) => err instanceof SkillError && err.code === 'INVALID_OUTPUT',
  );
});

test('omits an unknown optional filePath rather than emitting undefined', async () => {
  const noPath = {
    ...VALID_BRIEF,
    modelsAndTypes: [
      {
        name: 'CacheEntry',
        represents: 'A cached value.',
        whyNeeded: 'To store TTL.',
        importantFields: ['key'],
        evidence: 'confirmed',
      },
    ],
  };
  const model = new FakeLanguageModel(JSON.stringify(noPath));
  const skill = new DefaultTechnicalChangeBriefSkill(model);

  const brief = await skill.execute(input());

  assert.equal('filePath' in brief.modelsAndTypes[0]!, false);
});
