import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  OpenAICompatibleLanguageModel,
  type ModelFetch,
  type ModelResponse,
} from '../OpenAICompatibleLanguageModel.js';
import { LanguageModelError } from '../../errors/LanguageModelError.js';
import { setObservabilitySink, type ObservabilityRecord } from '../../observability/index.js';

type RecordedInit = Parameters<ModelFetch>[1];

/** Capture observability records while `fn` runs (async), then restore the sink. */
async function captureEvents(fn: () => Promise<void>): Promise<ObservabilityRecord[]> {
  const records: ObservabilityRecord[] = [];
  const previous = setObservabilitySink((record) => records.push(record));
  try {
    await fn();
  } finally {
    setObservabilitySink(previous);
  }
  return records;
}

function chatCompletion(content: string): ModelResponse {
  const body = { choices: [{ message: { content } }] };
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => JSON.stringify(body),
    json: async () => body,
  };
}

test('sends max_tokens, temperature, the model, and the prompt as a single user message', async () => {
  const calls: { url: string; init: RecordedInit }[] = [];
  const fetchImpl: ModelFetch = async (url, init) => {
    calls.push({ url, init });
    return chatCompletion('hi');
  };

  const model = new OpenAICompatibleLanguageModel({ apiKey: 'sk-secret', model: 'gpt-test', fetchImpl });
  const { text } = await model.generate({ prompt: 'Explain the diff.' });

  assert.equal(text, 'hi');
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, 'https://api.openai.com/v1/chat/completions');

  const body = JSON.parse(calls[0]!.init.body) as Record<string, unknown>;
  assert.equal(body['model'], 'gpt-test');
  assert.equal(body['temperature'], 0);
  assert.equal(body['max_tokens'], 8192); // default output cap
  assert.deepEqual(body['messages'], [{ role: 'user', content: 'Explain the diff.' }]);

  // The key is transmitted (so the no-leak tests below are meaningful), and the
  // request is carried under a timeout signal.
  assert.equal(calls[0]!.init.headers['authorization'], 'Bearer sk-secret');
  assert.ok(calls[0]!.init.signal instanceof AbortSignal);
});

test('honors a configured max_tokens output cap', async () => {
  let sentBody = '';
  const fetchImpl: ModelFetch = async (_url, init) => {
    sentBody = init.body;
    return chatCompletion('ok');
  };

  const model = new OpenAICompatibleLanguageModel({
    apiKey: 'sk',
    model: 'm',
    maxTokens: 256,
    fetchImpl,
  });
  await model.generate({ prompt: 'p' });

  assert.equal((JSON.parse(sentBody) as { max_tokens?: number }).max_tokens, 256);
});

test('aborts and throws a typed TIMEOUT error when the request exceeds the timeout', async () => {
  // A fetch that never resolves on its own; it only settles when the timeout
  // abort fires, mimicking a hanging provider.
  const fetchImpl: ModelFetch = (_url, init) =>
    new Promise<ModelResponse>((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        const err = new Error('The operation was aborted.');
        err.name = 'AbortError';
        reject(err);
      });
    });

  const model = new OpenAICompatibleLanguageModel({
    apiKey: 'sk-secret',
    model: 'm',
    timeoutMs: 10,
    fetchImpl,
  });

  await assert.rejects(
    () => model.generate({ prompt: 'p' }),
    (err: unknown) => err instanceof LanguageModelError && err.code === 'TIMEOUT',
  );
});

test('does not leak the API key in a provider (non-2xx) error', async () => {
  const apiKey = 'sk-super-secret-value';
  const fetchImpl: ModelFetch = async () => ({
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
    text: async () => 'upstream boom',
    json: async () => ({}),
  });

  const model = new OpenAICompatibleLanguageModel({ apiKey, model: 'm', fetchImpl });

  await assert.rejects(
    () => model.generate({ prompt: 'p' }),
    (err: unknown) => {
      assert.ok(err instanceof LanguageModelError);
      assert.equal(err.code, 'REQUEST');
      assert.equal(err.message.includes(apiKey), false);
      return true;
    },
  );
});

test('wraps a network error as REQUEST without leaking the API key', async () => {
  const apiKey = 'sk-secret-network';
  const fetchImpl: ModelFetch = async () => {
    throw new Error('ECONNREFUSED 1.2.3.4:443');
  };

  const model = new OpenAICompatibleLanguageModel({ apiKey, model: 'm', fetchImpl });

  await assert.rejects(
    () => model.generate({ prompt: 'p' }),
    (err: unknown) =>
      err instanceof LanguageModelError &&
      err.code === 'REQUEST' &&
      err.message.includes('ECONNREFUSED') &&
      !err.message.includes(apiKey),
  );
});

test('emits model_call_started/completed with safe fields only (no key, prompt, or response)', async () => {
  const apiKey = 'sk-observability-secret';
  const fetchImpl: ModelFetch = async () => chatCompletion('the model response text');
  const model = new OpenAICompatibleLanguageModel({ apiKey, model: 'gpt-obs', maxTokens: 256, timeoutMs: 5000, fetchImpl });

  const records = await captureEvents(async () => {
    await model.generate({ prompt: 'a secret-bearing prompt' });
  });

  const started = records.find((r) => r.event === 'model_call_started');
  const completed = records.find((r) => r.event === 'model_call_completed');
  assert.ok(started, 'model_call_started emitted');
  assert.ok(completed, 'model_call_completed emitted');
  assert.equal(started?.model, 'openai-compatible:gpt-obs');
  assert.equal(started?.maxTokens, 256);
  assert.equal(started?.timeoutMs, 5000);
  assert.equal(typeof completed?.durationMs, 'number');

  const serialized = JSON.stringify(records);
  assert.equal(serialized.includes(apiKey), false, 'no api key in logs');
  assert.equal(serialized.includes('secret-bearing prompt'), false, 'no prompt in logs');
  assert.equal(serialized.includes('the model response text'), false, 'no response in logs');
});

test('emits model_call_failed with the error code but not the API key or body', async () => {
  const apiKey = 'sk-failure-secret';
  const fetchImpl: ModelFetch = async () => ({
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
    text: async () => 'upstream boom with sk-failure-secret echoed back',
    json: async () => ({}),
  });
  const model = new OpenAICompatibleLanguageModel({ apiKey, model: 'm', fetchImpl });

  const records = await captureEvents(async () => {
    await assert.rejects(() => model.generate({ prompt: 'p' }));
  });

  const failed = records.find((r) => r.event === 'model_call_failed');
  assert.ok(failed, 'model_call_failed emitted');
  assert.equal(failed?.errorName, 'LanguageModelError');
  assert.equal(failed?.errorCode, 'REQUEST');
  assert.equal(JSON.stringify(records).includes(apiKey), false);
});

test('fromEnv builds a model from the required vars', () => {
  const env: NodeJS.ProcessEnv = { OPENAI_API_KEY: 'sk', OPENAI_MODEL: 'gpt-test' };
  const model = OpenAICompatibleLanguageModel.fromEnv(env);
  assert.equal(model.name, 'openai-compatible:gpt-test');
});

test('fromEnv fails closed (CONFIG) on an invalid OPENAI_MAX_TOKENS', () => {
  const env: NodeJS.ProcessEnv = {
    OPENAI_API_KEY: 'sk',
    OPENAI_MODEL: 'm',
    OPENAI_MAX_TOKENS: 'lots',
  };
  assert.throws(
    () => OpenAICompatibleLanguageModel.fromEnv(env),
    (err: unknown) => err instanceof LanguageModelError && err.code === 'CONFIG',
  );
});

test('fromEnv fails closed (CONFIG) on a non-positive OPENAI_TIMEOUT_MS', () => {
  const env: NodeJS.ProcessEnv = {
    OPENAI_API_KEY: 'sk',
    OPENAI_MODEL: 'm',
    OPENAI_TIMEOUT_MS: '0',
  };
  assert.throws(
    () => OpenAICompatibleLanguageModel.fromEnv(env),
    (err: unknown) => err instanceof LanguageModelError && err.code === 'CONFIG',
  );
});
