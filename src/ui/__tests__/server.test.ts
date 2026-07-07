import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';

import { createUiServer } from '../server.js';
import { MockAnalysisRunner } from '../analysisRunner.js';
import type { AnalysisRequest, AnalysisRunner } from '../types.js';
import type { AnalysisResult } from '../../analysis/index.js';

async function withServer(
  fn: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = createUiServer({ runner: new MockAnalysisRunner(), mode: 'mock' });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
}

/** Counts how many times the underlying runner is invoked (re-analysis guard). */
class SpyRunner implements AnalysisRunner {
  readonly name = 'spy';
  runCount = 0;
  private readonly inner = new MockAnalysisRunner();
  async run(request: AnalysisRequest): Promise<AnalysisResult> {
    this.runCount += 1;
    return this.inner.run(request);
  }
}

async function withSpyServer(
  fn: (baseUrl: string, runner: SpyRunner) => Promise<void>,
): Promise<void> {
  const runner = new SpyRunner();
  const server = createUiServer({ runner, mode: 'mock' });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await fn(baseUrl, runner);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
}

async function analyzeWithPr(baseUrl: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requirementText: 'Add caching',
      rawDiff: 'diff --git a b',
      includeFlow: true,
      includeGapReport: true,
      includePrDescription: true,
    }),
  });
  const data = (await res.json()) as { status: string; sessionId: string };
  assert.equal(data.status, 'success');
  return data.sessionId;
}

test('GET / serves the one-page UI shell', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /text\/html/);
    const html = await res.text();
    assert.match(html, /Run Initial Analysis/);
    assert.match(html, /id="rawDiff"/);
  });
});

test('POST /api/analyze runs the analysis handler and returns success', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requirementText: 'Add caching',
        rawDiff: 'diff --git a b',
        includeFlow: true,
        includeGapReport: true,
      }),
    });
    assert.equal(res.status, 200);
    const data = (await res.json()) as { status: string; cards?: { id: string }[] };
    assert.equal(data.status, 'success');
    assert.ok(data.cards?.some((c) => c.id === 'gapReport'));
  });
});

test('POST /api/analyze surfaces engine errors as an error response', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requirementText: '', rawDiff: '' }),
    });
    assert.equal(res.status, 200);
    const data = (await res.json()) as { status: string; message?: string };
    assert.equal(data.status, 'error');
    assert.match(data.message ?? '', /must not be empty/);
  });
});

test('invalid JSON body returns a 400 error response', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });
    assert.equal(res.status, 400);
    const data = (await res.json()) as { status: string };
    assert.equal(data.status, 'error');
  });
});

test('unknown route returns 404', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/nope`);
    assert.equal(res.status, 404);
  });
});

test('chat-edit updates the selected artifact without re-running analysis', async () => {
  await withSpyServer(async (baseUrl, runner) => {
    const sessionId = await analyzeWithPr(baseUrl);
    assert.equal(runner.runCount, 1);

    const res = await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/chat-edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artifactKey: 'prDescription', message: 'Make this shorter.' }),
    });
    assert.equal(res.status, 200);
    const data = (await res.json()) as {
      status: string;
      assistantMessage: string;
      card: { id: string; copyText?: string };
      canUndo: boolean;
    };
    assert.equal(data.status, 'success');
    assert.equal(data.card.id, 'prDescription');
    // Demo edit visibly changes the copyable PR markdown.
    assert.match(data.card.copyText ?? '', /edited per: "Make this shorter\."/);
    assert.equal(data.canUndo, true);
    // No additional analysis was triggered by the chat edit.
    assert.equal(runner.runCount, 1);
  });
});

test('undo-artifact-edit reverts the selected artifact', async () => {
  await withSpyServer(async (baseUrl, runner) => {
    const sessionId = await analyzeWithPr(baseUrl);

    await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/chat-edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artifactKey: 'prDescription', message: 'Make this shorter.' }),
    });

    const undo = await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/undo-artifact-edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artifactKey: 'prDescription' }),
    });
    assert.equal(undo.status, 200);
    const data = (await undo.json()) as { status: string; restored: boolean; canUndo: boolean };
    assert.equal(data.status, 'success');
    assert.equal(data.restored, true);
    assert.equal(data.canUndo, false);
    // Still no re-analysis.
    assert.equal(runner.runCount, 1);
  });
});

test('chat-edit on an unsupported artifact reports editing is unavailable', async () => {
  await withServer(async (baseUrl) => {
    const sessionId = await analyzeWithPr(baseUrl);
    const res = await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/chat-edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artifactKey: 'gapReport', message: 'edit' }),
    });
    const data = (await res.json()) as { status: string; message?: string };
    assert.equal(data.status, 'error');
    assert.match(data.message ?? '', /generated text artifacts only/);
  });
});

test('chat-edit for an unknown session reports session not found', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/sessions/does-not-exist/chat-edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artifactKey: 'prDescription', message: 'edit' }),
    });
    const data = (await res.json()) as { status: string; message?: string };
    assert.equal(data.status, 'error');
    assert.match(data.message ?? '', /Session not found/);
  });
});
