import { test } from 'node:test';
import assert from 'node:assert/strict';

import { AnalysisHarness } from '../AnalysisHarness.js';
import {
  setObservabilitySink,
  type ObservabilityRecord,
} from '../../observability/index.js';
import type {
  ChangeExplanation,
  ChangeExplanationSkill,
} from '../../skills/changeExplanation/index.js';
import type {
  RequirementAlignment,
  RequirementAlignmentSkill,
} from '../../skills/requirementAlignment/index.js';

const CHANGE_EXPLANATION: ChangeExplanation = {
  changeStory: 'Adds a planning stage.',
  keyFunctionalities: ['Planning'],
  flow: ['In', 'Plan', 'Out'],
  mainComponents: [{ name: 'Planner', responsibility: 'Builds a plan.' }],
  architecturalDecisions: ['Separate planning'],
  impactAnalysis: ['Execution depends on planning'],
  uncertainties: [],
};

const REQUIREMENT_ALIGNMENT: RequirementAlignment = {
  requirementSummary: 'Add planning.',
  satisfiedItems: ['Planning present'],
  partiallySatisfiedItems: [],
  missingItems: [],
  unclearItems: [],
  overallAssessment: 'Implemented.',
  confidence: 'high',
};

const changeExplanationSkill: ChangeExplanationSkill = {
  name: 'test-change-explanation',
  async execute() {
    return CHANGE_EXPLANATION;
  },
};

const requirementAlignmentSkill: RequirementAlignmentSkill = {
  name: 'test-requirement-alignment',
  async execute() {
    return REQUIREMENT_ALIGNMENT;
  },
};

/** A harness with just the two base skills so only the base steps run. */
function makeHarness(): AnalysisHarness {
  return new AnalysisHarness({
    changeExplanation: changeExplanationSkill,
    requirementAlignment: requirementAlignmentSkill,
  });
}

/** Capture all events emitted while `fn` runs (async), then restore the sink. */
async function captureAsync(fn: () => Promise<void>): Promise<ObservabilityRecord[]> {
  const records: ObservabilityRecord[] = [];
  const previous = setObservabilitySink((record) => records.push(record));
  try {
    await fn();
  } finally {
    setObservabilitySink(previous);
  }
  return records;
}

const RUN_INPUT = {
  rawDiff: 'diff --git a/a b/a\n+planning',
  requirementText: 'Add a planning stage before execution.',
  includeFlow: false,
  includeGapReport: false,
} as const;

test('a run emits run_started then run_completed carrying the result traceId', async () => {
  const harness = makeHarness();
  let result;
  const records = await captureAsync(async () => {
    result = await harness.runAnalysis({ ...RUN_INPUT });
  });

  const started = records.find((r) => r.event === 'run_started');
  const completed = records.find((r) => r.event === 'run_completed');
  assert.ok(started, 'run_started emitted');
  assert.ok(completed, 'run_completed emitted');
  assert.equal(typeof result!.traceId, 'string');
  // Every run event shares the one trace id, and it matches the result.
  assert.equal(started?.traceId, result!.traceId);
  assert.equal(completed?.traceId, result!.traceId);
  assert.equal(typeof completed?.durationMs, 'number');
});

test('each workflow step emits step_started and step_completed with timing', async () => {
  const harness = makeHarness();
  const records = await captureAsync(async () => {
    await harness.runAnalysis({ ...RUN_INPUT });
  });

  for (const step of ['normalizeRequirement', 'changeExplanation', 'requirementAlignment']) {
    const startedForStep = records.find((r) => r.event === 'step_started' && r.step === step);
    const completedForStep = records.find((r) => r.event === 'step_completed' && r.step === step);
    assert.ok(startedForStep, `step_started for ${step}`);
    assert.ok(completedForStep, `step_completed for ${step}`);
    assert.equal(typeof completedForStep?.durationMs, 'number');
    assert.equal(completedForStep?.cached, false);
  }
});

test('reusing a session with unchanged inputs emits step_skipped_cached', async () => {
  const harness = makeHarness();
  const first = await harness.runAnalysis({ ...RUN_INPUT });

  const records = await captureAsync(async () => {
    await harness.runAnalysis({ ...RUN_INPUT, sessionId: first.sessionId });
  });

  const skipped = records.filter((r) => r.event === 'step_skipped_cached');
  assert.ok(skipped.length > 0, 'at least one step was skipped as cached');
  assert.ok(skipped.every((r) => r.cached === true));
  // A cached step must NOT emit a fresh started/completed pair.
  assert.equal(records.some((r) => r.event === 'step_started'), false);
});

test('a failing step emits step_failed and the run emits run_failed (no secrets)', async () => {
  const failingChange: ChangeExplanationSkill = {
    name: 'failing-change-explanation',
    async execute() {
      throw new Error('boom while explaining the diff: sk-should-not-leak');
    },
  };
  const harness = new AnalysisHarness({
    changeExplanation: failingChange,
    requirementAlignment: requirementAlignmentSkill,
  });

  const records = await captureAsync(async () => {
    await assert.rejects(() => harness.runAnalysis({ ...RUN_INPUT }));
  });

  const stepFailed = records.find((r) => r.event === 'step_failed');
  const runFailed = records.find((r) => r.event === 'run_failed');
  assert.ok(stepFailed, 'step_failed emitted');
  assert.ok(runFailed, 'run_failed emitted');
  assert.equal(stepFailed?.errorName, 'Error');
  // The error message (which could carry sensitive text) is never logged.
  assert.equal(JSON.stringify(records).includes('sk-should-not-leak'), false);
});
