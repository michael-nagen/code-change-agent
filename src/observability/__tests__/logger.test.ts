import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  logEvent,
  runWithTrace,
  updateTraceContext,
  getTraceContext,
  newTraceId,
  startTimer,
  describeErrorForLog,
  setObservabilitySink,
  resetObservabilitySink,
  type ObservabilityRecord,
} from '../logger.js';

/** Capture emitted records for the duration of `fn`, then restore the sink. */
function capture(fn: () => void): ObservabilityRecord[] {
  const records: ObservabilityRecord[] = [];
  const previous = setObservabilitySink((record) => records.push(record));
  try {
    fn();
  } finally {
    setObservabilitySink(previous);
  }
  return records;
}

test('logEvent stamps the trace id from the surrounding run', () => {
  const traceId = newTraceId();
  const records = capture(() => {
    runWithTrace({ traceId }, () => {
      logEvent({ event: 'run_started', fields: { requestedOutputs: { flow: true } } });
    });
  });
  assert.equal(records.length, 1);
  assert.equal(records[0]?.event, 'run_started');
  assert.equal(records[0]?.traceId, traceId);
});

test('updateTraceContext adds fields (e.g. sessionId) to later events in the run', () => {
  const traceId = newTraceId();
  const records = capture(() => {
    runWithTrace({ traceId }, () => {
      updateTraceContext({ sessionId: 'sess-1', projectId: 'proj-1' });
      logEvent({ event: 'step_started', fields: { step: 'changeExplanation' } });
    });
  });
  assert.equal(records[0]?.sessionId, 'sess-1');
  assert.equal(records[0]?.projectId, 'proj-1');
  assert.equal(records[0]?.step, 'changeExplanation');
});

test('outside a run there is no trace context and no traceId is emitted', () => {
  assert.deepEqual(getTraceContext(), {});
  const records = capture(() => {
    logEvent({ event: 'memory_saved', fields: { scope: 'user' } });
  });
  assert.equal(records[0]?.traceId, undefined);
  assert.equal(records[0]?.scope, 'user');
});

test('sensitive fields are never logged (secrets and raw source content)', () => {
  const records = capture(() => {
    logEvent({
      event: 'model_call_started',
      fields: {
        model: 'openai-compatible:gpt-test',
        maxTokens: 8192,
        timeoutMs: 60000,
        // None of these should ever appear verbatim:
        apiKey: 'sk-super-secret',
        authorization: 'Bearer sk-super-secret',
        prompt: 'the full model prompt',
        response: 'the full model response',
        rawDiff: 'diff --git a/x b/x',
        requirementText: 'the raw spec text',
        databaseUrl: 'postgres://user:pass@host/db',
      },
    });
  });
  const record = records[0]!;
  // Safe, useful fields are kept.
  assert.equal(record.model, 'openai-compatible:gpt-test');
  assert.equal(record.maxTokens, 8192);
  assert.equal(record.timeoutMs, 60000);
  // Sensitive fields are redacted.
  for (const key of ['apiKey', 'authorization', 'prompt', 'response', 'rawDiff', 'requirementText', 'databaseUrl']) {
    assert.equal(record[key], '[redacted]', `${key} must be redacted`);
  }
  // And the secret value appears nowhere in the serialized record.
  assert.ok(!JSON.stringify(record).includes('sk-super-secret'));
  assert.ok(!JSON.stringify(record).includes('postgres://'));
});

test('long strings are truncated so large content cannot leak in by accident', () => {
  const big = 'x'.repeat(5000);
  const records = capture(() => {
    logEvent({ event: 'step_completed', fields: { note: big } });
  });
  const note = records[0]?.note;
  assert.equal(typeof note, 'string');
  assert.ok((note as string).length < 300);
  assert.ok((note as string).includes('[+4800 chars]'));
});

test('describeErrorForLog exposes only the error name and safe code, never the message', () => {
  class Timeoutish extends Error {
    code = 'TIMEOUT';
    constructor() {
      super('provider body: <a raw response that must not be logged>');
      this.name = 'LanguageModelError';
    }
  }
  const described = describeErrorForLog(new Timeoutish());
  assert.deepEqual(described, { errorName: 'LanguageModelError', errorCode: 'TIMEOUT' });
  assert.equal(JSON.stringify(described).includes('raw response'), false);
});

test('startTimer returns a non-negative rounded duration', () => {
  const stop = startTimer();
  const ms = stop();
  assert.ok(Number.isInteger(ms));
  assert.ok(ms >= 0);
});

test('resetObservabilitySink restores default without throwing', () => {
  resetObservabilitySink();
  assert.doesNotThrow(() => resetObservabilitySink());
});
