import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseFormSubmission, RequestParseError } from '../parseRequest.js';

test('parseFormSubmission reads text fields and trims project name', () => {
  const sub = parseFormSubmission({
    projectName: '  my-service  ',
    requirementText: 'Add caching',
    rawDiff: 'diff --git a b',
  });
  assert.equal(sub.projectName, 'my-service');
  assert.equal(sub.requirementText, 'Add caching');
  assert.equal(sub.rawDiff, 'diff --git a b');
});

test('inputMode defaults to manual when omitted', () => {
  const sub = parseFormSubmission({ requirementText: 'r', rawDiff: 'd' });
  assert.equal(sub.inputMode, 'manual');
});

test('inputMode is preserved for supported modes', () => {
  for (const mode of ['manual', 'githubUrl', 'websiteContextUrl', 'notionText'] as const) {
    const sub = parseFormSubmission({ inputMode: mode });
    assert.equal(sub.inputMode, mode);
  }
});

test('unsupported inputMode throws RequestParseError (no fake data)', () => {
  assert.throws(() => parseFormSubmission({ inputMode: 'ftp' }), RequestParseError);
});

test('mode-specific URL/text fields are captured', () => {
  const sub = parseFormSubmission({
    inputMode: 'githubUrl',
    githubUrl: '  https://github.com/o/r/pull/1  ',
    websiteUrl: '  https://example.com  ',
    notionText: 'pasted notion',
  });
  assert.equal(sub.githubUrl, 'https://github.com/o/r/pull/1');
  assert.equal(sub.websiteUrl, 'https://example.com');
  assert.equal(sub.notionText, 'pasted notion');
});

test('parseFormSubmission omits empty project name', () => {
  const sub = parseFormSubmission({ requirementText: 'r', rawDiff: 'd' });
  assert.equal(sub.projectName, undefined);
});

test('include flags can be toggled independently', () => {
  const allOff = parseFormSubmission({ requirementText: 'r', rawDiff: 'd' });
  assert.deepEqual(
    {
      includeFlow: allOff.includeFlow,
      includeGapReport: allOff.includeGapReport,
      includePrDescription: allOff.includePrDescription,
      includeVideoScript: allOff.includeVideoScript,
      includeDailyUpdate: allOff.includeDailyUpdate,
    },
    {
      includeFlow: false,
      includeGapReport: false,
      includePrDescription: false,
      includeVideoScript: false,
      includeDailyUpdate: false,
    },
  );

  const someOn = parseFormSubmission({
    requirementText: 'r',
    rawDiff: 'd',
    includeFlow: true,
    includeGapReport: true,
    includeVideoScript: true,
  });
  assert.equal(someOn.includeFlow, true);
  assert.equal(someOn.includeGapReport, true);
  assert.equal(someOn.includeVideoScript, true);
  assert.equal(someOn.includePrDescription, false);
  assert.equal(someOn.includeDailyUpdate, false);
});

test('non-boolean flag values are coerced to false (only true counts)', () => {
  const sub = parseFormSubmission({
    requirementText: 'r',
    rawDiff: 'd',
    includeFlow: 'yes',
    includeGapReport: 1,
  });
  assert.equal(sub.includeFlow, false);
  assert.equal(sub.includeGapReport, false);
});

test('parseFormSubmission rejects non-object bodies', () => {
  assert.throws(() => parseFormSubmission(null), RequestParseError);
  assert.throws(() => parseFormSubmission('nope'), RequestParseError);
  assert.throws(() => parseFormSubmission([1, 2]), RequestParseError);
});
