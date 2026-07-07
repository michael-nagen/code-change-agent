import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ANALYZE_CODE_CHANGE_WORKFLOW,
  assertWorkflowIncludeFlags,
} from '../workflowDefinition.js';
import type { AnalysisIncludeFlags, WorkflowStepDefinition } from '../types/index.js';

const ALL_ON: AnalysisIncludeFlags = {
  includeFlow: true,
  includeGapReport: true,
  includeVideoScript: true,
  includePrDescription: true,
  includeDailyUpdate: true,
  includeDailyWorkGuidance: true,
  includeTechnicalChangeBrief: true,
  includeDemoPrepLoop: true,
  includeWeeklyReview: true,
};

const DEFAULTS: AnalysisIncludeFlags = {
  includeFlow: true,
  includeGapReport: true,
  includeVideoScript: false,
  includePrDescription: false,
  includeDailyUpdate: false,
  includeDailyWorkGuidance: false,
  includeTechnicalChangeBrief: false,
  includeDemoPrepLoop: false,
  includeWeeklyReview: false,
};

function stepByName(name: string): WorkflowStepDefinition {
  const step = ANALYZE_CODE_CHANGE_WORKFLOW.find((s) => s.name === name);
  assert.ok(step, `expected a step named ${name}`);
  return step;
}

test('the workflow definition is declared in the expected execution order', () => {
  assert.deepEqual(
    ANALYZE_CODE_CHANGE_WORKFLOW.map((step) => step.name),
    [
      'normalizeRequirement',
      'changeExplanation',
      'flowGeneration',
      'requirementAlignment',
      'gapReport',
      'videoScript',
      'prDescription',
      'dailyUpdate',
      'dailyWorkGuidance',
      'technicalChangeBrief',
      'demoPrepLoop',
      'weeklyReview',
    ],
  );
});

test('each step declares the artifact it produces (except normalizeRequirement)', () => {
  assert.equal(stepByName('normalizeRequirement').artifactKey, undefined);
  assert.equal(stepByName('changeExplanation').artifactKey, 'changeExplanation');
  assert.equal(stepByName('flowGeneration').artifactKey, 'flowArtifact');
  assert.equal(stepByName('requirementAlignment').artifactKey, 'requirementAlignment');
  assert.equal(stepByName('gapReport').artifactKey, 'gapReport');
  assert.equal(stepByName('videoScript').artifactKey, 'videoScript');
  assert.equal(stepByName('prDescription').artifactKey, 'prDescription');
  assert.equal(stepByName('dailyUpdate').artifactKey, 'dailyUpdate');
  assert.equal(stepByName('dailyWorkGuidance').artifactKey, 'dailyWorkGuidance');
  assert.equal(stepByName('technicalChangeBrief').artifactKey, 'technicalChangeBrief');
  assert.equal(stepByName('demoPrepLoop').artifactKey, 'demoPrepLoop');
  assert.equal(stepByName('weeklyReview').artifactKey, 'weeklyReview');
});

test('dependencies and include flags are declared for flow/gap/video/pr/daily', () => {
  assert.deepEqual(stepByName('flowGeneration').dependsOn, ['changeExplanation']);
  assert.equal(stepByName('flowGeneration').includeFlag, 'includeFlow');

  assert.deepEqual(stepByName('gapReport').dependsOn, ['changeExplanation', 'requirementAlignment']);
  assert.equal(stepByName('gapReport').includeFlag, 'includeGapReport');

  assert.deepEqual(stepByName('videoScript').dependsOn, [
    'changeExplanation',
    'requirementAlignment',
    'gapReport',
    'flowGeneration',
  ]);
  assert.equal(stepByName('videoScript').includeFlag, 'includeVideoScript');

  assert.deepEqual(stepByName('prDescription').dependsOn, [
    'changeExplanation',
    'requirementAlignment',
    'gapReport',
    'flowGeneration',
  ]);
  assert.equal(stepByName('prDescription').includeFlag, 'includePrDescription');

  assert.deepEqual(stepByName('dailyUpdate').dependsOn, [
    'changeExplanation',
    'requirementAlignment',
    'gapReport',
    'prDescription',
    'flowGeneration',
  ]);
  assert.equal(stepByName('dailyUpdate').includeFlag, 'includeDailyUpdate');

  assert.deepEqual(stepByName('dailyWorkGuidance').dependsOn, [
    'changeExplanation',
    'requirementAlignment',
    'gapReport',
    'flowGeneration',
  ]);
  assert.equal(stepByName('dailyWorkGuidance').includeFlag, 'includeDailyWorkGuidance');

  assert.deepEqual(stepByName('technicalChangeBrief').dependsOn, [
    'changeExplanation',
    'requirementAlignment',
  ]);
  assert.equal(stepByName('technicalChangeBrief').includeFlag, 'includeTechnicalChangeBrief');

  assert.deepEqual(stepByName('demoPrepLoop').dependsOn, [
    'changeExplanation',
    'requirementAlignment',
  ]);
  assert.equal(stepByName('demoPrepLoop').includeFlag, 'includeDemoPrepLoop');

  assert.deepEqual(stepByName('weeklyReview').dependsOn, [
    'changeExplanation',
    'requirementAlignment',
  ]);
  assert.equal(stepByName('weeklyReview').includeFlag, 'includeWeeklyReview');
});

test('required steps declare no include flag', () => {
  assert.equal(stepByName('normalizeRequirement').includeFlag, undefined);
  assert.equal(stepByName('changeExplanation').includeFlag, undefined);
  assert.equal(stepByName('requirementAlignment').includeFlag, undefined);
});

test('valid include combinations pass validation', () => {
  assert.doesNotThrow(() => assertWorkflowIncludeFlags(DEFAULTS));
  assert.doesNotThrow(() => assertWorkflowIncludeFlags(ALL_ON));
  assert.doesNotThrow(() =>
    assertWorkflowIncludeFlags({ ...DEFAULTS, includeVideoScript: true }),
  );
  assert.doesNotThrow(() =>
    assertWorkflowIncludeFlags({ ...DEFAULTS, includePrDescription: true }),
  );
  assert.doesNotThrow(() =>
    assertWorkflowIncludeFlags({
      ...DEFAULTS,
      includePrDescription: true,
      includeDailyUpdate: true,
    }),
  );
  assert.doesNotThrow(() =>
    assertWorkflowIncludeFlags({ ...DEFAULTS, includeDailyWorkGuidance: true }),
  );
  assert.doesNotThrow(() =>
    assertWorkflowIncludeFlags({ ...DEFAULTS, includeTechnicalChangeBrief: true }),
  );
  // The technical change brief depends only on the required base analysis, so it
  // stays valid even when the optional flow and gap-report steps are disabled.
  assert.doesNotThrow(() =>
    assertWorkflowIncludeFlags({
      ...DEFAULTS,
      includeFlow: false,
      includeGapReport: false,
      includeTechnicalChangeBrief: true,
    }),
  );
  assert.doesNotThrow(() =>
    assertWorkflowIncludeFlags({ ...DEFAULTS, includeDemoPrepLoop: true }),
  );
  // The demo prep loop likewise depends only on the required base analysis.
  assert.doesNotThrow(() =>
    assertWorkflowIncludeFlags({
      ...DEFAULTS,
      includeFlow: false,
      includeGapReport: false,
      includeDemoPrepLoop: true,
    }),
  );
  // The weekly review depends only on the required base analysis too.
  assert.doesNotThrow(() =>
    assertWorkflowIncludeFlags({ ...DEFAULTS, includeWeeklyReview: true }),
  );
  assert.doesNotThrow(() =>
    assertWorkflowIncludeFlags({
      ...DEFAULTS,
      includeFlow: false,
      includeGapReport: false,
      includeWeeklyReview: true,
    }),
  );
});

test('a disabled prerequisite fails validation with a clear message', () => {
  assert.throws(
    () => assertWorkflowIncludeFlags({ ...ALL_ON, includeFlow: false }),
    /includeVideoScript requires includeFlow to be enabled/,
  );
  assert.throws(
    () => assertWorkflowIncludeFlags({ ...DEFAULTS, includePrDescription: true, includeFlow: false }),
    /includePrDescription requires includeFlow to be enabled/,
  );
  assert.throws(
    () => assertWorkflowIncludeFlags({ ...DEFAULTS, includeVideoScript: true, includeGapReport: false }),
    /includeVideoScript requires includeGapReport to be enabled/,
  );
  assert.throws(
    () => assertWorkflowIncludeFlags({ ...DEFAULTS, includeDailyUpdate: true }),
    /includeDailyUpdate requires includePrDescription to be enabled/,
  );
  assert.throws(
    () =>
      assertWorkflowIncludeFlags({
        ...DEFAULTS,
        includeDailyWorkGuidance: true,
        includeGapReport: false,
      }),
    /includeDailyWorkGuidance requires includeGapReport to be enabled/,
  );
});

test('multiple disabled prerequisites are all reported', () => {
  assert.throws(
    () =>
      assertWorkflowIncludeFlags({
        ...DEFAULTS,
        includePrDescription: true,
        includeFlow: false,
        includeGapReport: false,
      }),
    /includePrDescription requires includeGapReport, includeFlow to be enabled/,
  );
});
