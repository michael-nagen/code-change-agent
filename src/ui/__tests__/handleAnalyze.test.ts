import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { AnalysisResult } from '../../analysis/index.js';
import type { AnalysisRequest, AnalysisRunner } from '../types.js';
import type { FetchLike } from '../normalizeInput.js';
import { handleAnalyze } from '../handleAnalyze.js';
import { MockAnalysisRunner } from '../analysisRunner.js';

class SpyRunner implements AnalysisRunner {
  readonly name = 'spy';
  calls: AnalysisRequest[] = [];
  constructor(private readonly impl: (r: AnalysisRequest) => Promise<AnalysisResult>) {}
  async run(request: AnalysisRequest): Promise<AnalysisResult> {
    this.calls.push(request);
    return this.impl(request);
  }
}

const okResult: AnalysisResult = {
  sessionId: 'sess-ok',
  requirementInput: { requirementText: 'r', source: 'manual' },
  changeExplanation: {
    changeStory: 's',
    keyFunctionalities: [],
    flow: [],
    mainComponents: [],
    architecturalDecisions: [],
    impactAnalysis: [],
    uncertainties: [],
  },
  requirementAlignment: {
    requirementSummary: 'rs',
    satisfiedItems: [],
    partiallySatisfiedItems: [],
    missingItems: [],
    unclearItems: [],
    overallAssessment: 'oa',
    confidence: 'low',
  },
};

test('the run handler calls the injected runner with parsed request', async () => {
  const runner = new SpyRunner(async () => okResult);
  const response = await handleAnalyze({
    runner,
    mode: 'mock',
    body: { requirementText: 'r', rawDiff: 'd', includeFlow: true },
  });
  assert.equal(runner.calls.length, 1);
  assert.equal(runner.calls[0]?.includeFlow, true);
  assert.equal(response.status, 'success');
});

test('success response carries session id and workspace cards', async () => {
  const runner = new SpyRunner(async () => okResult);
  const response = await handleAnalyze({ runner, mode: 'mock', body: { requirementText: 'r', rawDiff: 'd' } });
  assert.equal(response.status, 'success');
  if (response.status !== 'success') return;
  assert.equal(response.sessionId, 'sess-ok');
  assert.ok(response.cards.length >= 7);
  assert.ok(response.cards.some((c) => c.id === 'changeExplanation'));
});

test('runner errors become an error response with the ACTUAL message', async () => {
  const runner = new SpyRunner(async () => {
    throw new Error('boom: model refused');
  });
  const response = await handleAnalyze({ runner, mode: 'real', body: { requirementText: 'r', rawDiff: 'd' } });
  assert.equal(response.status, 'error');
  if (response.status !== 'error') return;
  assert.equal(response.message, 'boom: model refused');
  assert.equal(response.mode, 'real');
});

test('malformed body returns an error response, never throws', async () => {
  const runner = new SpyRunner(async () => okResult);
  const response = await handleAnalyze({ runner, mode: 'mock', body: 'not-an-object' });
  assert.equal(response.status, 'error');
  assert.equal(runner.calls.length, 0);
});

test('mock runner end-to-end produces labeled demo artifacts', async () => {
  const response = await handleAnalyze({
    runner: new MockAnalysisRunner(),
    mode: 'mock',
    body: {
      requirementText: 'Add caching',
      rawDiff: 'diff --git a b',
      includeFlow: true,
      includeGapReport: true,
    },
  });
  assert.equal(response.status, 'success');
  if (response.status !== 'success') return;
  const gap = response.cards.find((c) => c.id === 'gapReport');
  assert.match(gap?.html ?? '', /DEMO\/MOCK/);
});

test('mock runner enforces include-flag dependencies like the engine', async () => {
  const response = await handleAnalyze({
    runner: new MockAnalysisRunner(),
    mode: 'mock',
    body: { requirementText: 'r', rawDiff: 'd', includePrDescription: true },
  });
  assert.equal(response.status, 'error');
  if (response.status !== 'error') return;
  assert.match(response.message, /includePrDescription requires/);
});

function fetchReturning(body: string): FetchLike {
  return async () => ({ ok: true, status: 200, text: async () => body });
}

test('all input modes normalize and call the SAME runner', async () => {
  // GitHub: diff comes from the fetched .diff, requirement from the textarea.
  const ghRunner = new SpyRunner(async () => okResult);
  await handleAnalyze({
    runner: ghRunner,
    mode: 'mock',
    body: {
      inputMode: 'githubUrl',
      githubUrl: 'https://github.com/o/r/pull/1',
      requirementText: 'gh req',
    },
    fetchImpl: fetchReturning('diff --git a/a b/a\n+x'),
  });
  assert.equal(ghRunner.calls.length, 1);
  assert.match(ghRunner.calls[0]?.rawDiff ?? '', /diff --git/);
  assert.equal(ghRunner.calls[0]?.requirementText, 'gh req');

  // Website: requirement comes from extracted page text, diff from the textarea.
  const wsRunner = new SpyRunner(async () => okResult);
  await handleAnalyze({
    runner: wsRunner,
    mode: 'mock',
    body: {
      inputMode: 'websiteContextUrl',
      websiteUrl: 'https://example.com/spec',
      rawDiff: 'diff --git a/b b/b',
    },
    fetchImpl: fetchReturning('<p>Spec: build X.</p>'),
  });
  assert.equal(wsRunner.calls.length, 1);
  assert.match(wsRunner.calls[0]?.requirementText ?? '', /Spec: build X\./);
  assert.equal(wsRunner.calls[0]?.rawDiff, 'diff --git a/b b/b');

  // Notion: pasted text is the requirement, diff from the textarea, no network.
  const ntRunner = new SpyRunner(async () => okResult);
  await handleAnalyze({
    runner: ntRunner,
    mode: 'mock',
    body: {
      inputMode: 'notionText',
      notionText: 'notion requirement',
      rawDiff: 'diff --git a/c b/c',
    },
  });
  assert.equal(ntRunner.calls.length, 1);
  assert.equal(ntRunner.calls[0]?.requirementText, 'notion requirement');
});

test('github-mode fetch failure surfaces as a clear error response', async () => {
  const runner = new SpyRunner(async () => okResult);
  const response = await handleAnalyze({
    runner,
    mode: 'real',
    body: { inputMode: 'githubUrl', githubUrl: 'https://github.com/o/r/pull/1' },
    fetchImpl: async () => ({ ok: false, status: 404, text: async () => '' }),
  });
  assert.equal(response.status, 'error');
  if (response.status !== 'error') return;
  assert.match(response.message, /404|private|not exist/i);
  assert.equal(runner.calls.length, 0, 'runner must not run when normalization fails');
});

test('unsupported inputMode is rejected, no fake data submitted', async () => {
  const runner = new SpyRunner(async () => okResult);
  const response = await handleAnalyze({
    runner,
    mode: 'mock',
    body: { inputMode: 'carrierPigeon', requirementText: 'r', rawDiff: 'd' },
  });
  assert.equal(response.status, 'error');
  assert.equal(runner.calls.length, 0);
});

test('success response includes overview (readiness + confidence) and echoed inputs', async () => {
  const response = await handleAnalyze({
    runner: new MockAnalysisRunner(),
    mode: 'mock',
    body: { requirementText: 'Add caching', rawDiff: 'diff --git a b', includeFlow: true, includeGapReport: true },
  });
  assert.equal(response.status, 'success');
  if (response.status !== 'success') return;
  assert.equal(typeof response.overview.confidence, 'string');
  assert.equal(response.overview.readiness, 'unclear'); // mock gapReport readiness
  assert.equal(response.inputs.requirementText, 'Add caching');
  assert.equal(response.inputs.rawDiff, 'diff --git a b');
});

test('initial analysis (base flags only) leaves optional outputs not-generated', async () => {
  const response = await handleAnalyze({
    runner: new MockAnalysisRunner(),
    mode: 'mock',
    body: { requirementText: 'r', rawDiff: 'd', includeFlow: true, includeGapReport: true },
  });
  assert.equal(response.status, 'success');
  if (response.status !== 'success') return;
  const stateOf = (id: string) => response.cards.find((c) => c.id === id)?.state;
  assert.equal(stateOf('changeExplanation'), 'generated');
  assert.equal(stateOf('gapReport'), 'generated');
  assert.equal(stateOf('flowArtifact'), 'generated');
  assert.equal(stateOf('prDescription'), 'not_generated');
  assert.equal(stateOf('videoScript'), 'not_generated');
  assert.equal(stateOf('dailyUpdate'), 'not_generated');
});

test('on-demand generation: re-running with sessionId + a new flag produces that output', async () => {
  const runner = new MockAnalysisRunner();
  const initial = await handleAnalyze({
    runner,
    mode: 'mock',
    body: { requirementText: 'r', rawDiff: 'd', includeFlow: true, includeGapReport: true },
  });
  assert.equal(initial.status, 'success');
  if (initial.status !== 'success') return;

  // Simulate the client's "Generate PR Draft": same session, add the PR flag
  // (plus its already-generated deps), resend resolved inputs as manual.
  const followUp = await handleAnalyze({
    runner,
    mode: 'mock',
    body: {
      inputMode: 'manual',
      sessionId: initial.sessionId,
      requirementText: initial.inputs.requirementText,
      rawDiff: initial.inputs.rawDiff,
      includeFlow: true,
      includeGapReport: true,
      includePrDescription: true,
    },
  });
  assert.equal(followUp.status, 'success');
  if (followUp.status !== 'success') return;
  assert.equal(followUp.sessionId, initial.sessionId, 'session continues');
  const pr = followUp.cards.find((c) => c.id === 'prDescription');
  assert.equal(pr?.state, 'generated');
  assert.ok(pr?.copyText, 'PR Draft carries copyable text');
});
