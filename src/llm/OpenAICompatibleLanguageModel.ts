import { LanguageModelError } from '../errors/LanguageModelError.js';
import { logEvent, startTimer, describeErrorForLog } from '../observability/index.js';
import type { LanguageModel, LanguageModelInput, LanguageModelOutput } from './LanguageModel.js';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

/**
 * Output cap applied to every completion unless overridden. It bounds cost and
 * prevents a runaway/hostile response from generating without limit. It is
 * generous enough for the large structured artifacts this app produces; raise
 * OPENAI_MAX_TOKENS if a very large artifact is being truncated.
 */
const DEFAULT_MAX_TOKENS = 8192;

/** Requests are aborted after this many ms unless overridden, so a stalled provider can never hang a run. */
const DEFAULT_TIMEOUT_MS = 60_000;

/** Minimal response contract; the global `fetch` `Response` satisfies it. */
export interface ModelResponse {
  ok: boolean;
  status: number;
  statusText: string;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

/**
 * Injectable network impl so the adapter is testable without hitting a real
 * host (mirrors the source layer's `SourceFetch`). The default wraps the global
 * `fetch`. The `signal` carries the timeout abort.
 */
export type ModelFetch = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  },
) => Promise<ModelResponse>;

const defaultModelFetch: ModelFetch = (url, init) =>
  fetch(url, init as RequestInit) as unknown as Promise<ModelResponse>;

/**
 * Configuration for the provider. It is passed explicitly (not read from the
 * environment here) so the class stays a pure adapter; env reading lives in the
 * `fromEnv` factory. The apiKey is held privately and never logged.
 */
export interface OpenAICompatibleConfig {
  apiKey: string;
  model: string;
  /** Defaults to the OpenAI public endpoint. Set this for compatible gateways. */
  baseUrl?: string;
  /** Max output tokens per completion. Defaults to a safe generous cap. */
  maxTokens?: number;
  /** Abort the request after this many ms. Defaults to 60s. */
  timeoutMs?: number;
  /** Injectable network impl for tests; defaults to the global `fetch`. */
  fetchImpl?: ModelFetch;
}

/**
 * A concrete LanguageModel backed by any OpenAI-compatible Chat Completions
 * endpoint, using the global `fetch` (no SDK dependency). Skills depend only on
 * the LanguageModel interface, so this provider is fully swappable.
 *
 * Every request is bounded: a `max_tokens` output cap and an AbortController
 * timeout protect against runaway or hanging calls. Failures surface as typed
 * `LanguageModelError`s whose messages never include the API key.
 */
export class OpenAICompatibleLanguageModel implements LanguageModel {
  readonly name: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly maxTokens: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: ModelFetch;

  constructor({ apiKey, model, baseUrl, maxTokens, timeoutMs, fetchImpl }: OpenAICompatibleConfig) {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = (baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.maxTokens = maxTokens ?? DEFAULT_MAX_TOKENS;
    this.timeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = fetchImpl ?? defaultModelFetch;
    this.name = `openai-compatible:${model}`;
  }

  /**
   * Reads configuration from the environment and fails clearly when required
   * variables are missing or invalid. Never logs or echoes the API key.
   *
   * - OPENAI_API_KEY    (required)
   * - OPENAI_MODEL      (required)
   * - OPENAI_BASE_URL   (optional; defaults to the OpenAI public endpoint)
   * - OPENAI_MAX_TOKENS (optional; positive integer; defaults to a safe cap)
   * - OPENAI_TIMEOUT_MS (optional; positive integer; defaults to 60000)
   */
  static fromEnv(env: NodeJS.ProcessEnv = process.env): OpenAICompatibleLanguageModel {
    const apiKey = readEnv({ env, key: 'OPENAI_API_KEY' });
    const model = readEnv({ env, key: 'OPENAI_MODEL' });
    const baseUrl = readEnv({ env, key: 'OPENAI_BASE_URL' });

    // A single guard that both reports every missing var and narrows the
    // required values to plain strings for the constructor below.
    if (apiKey === undefined || model === undefined) {
      const missing = [
        ...(apiKey === undefined ? ['OPENAI_API_KEY'] : []),
        ...(model === undefined ? ['OPENAI_MODEL'] : []),
      ];
      throw new LanguageModelError(
        'CONFIG',
        `Missing required environment variable(s): ${missing.join(', ')}. ` +
          'Set OPENAI_API_KEY and OPENAI_MODEL (and optionally OPENAI_BASE_URL).',
      );
    }

    const maxTokens = readPositiveIntEnv({ env, key: 'OPENAI_MAX_TOKENS', fallback: DEFAULT_MAX_TOKENS });
    const timeoutMs = readPositiveIntEnv({ env, key: 'OPENAI_TIMEOUT_MS', fallback: DEFAULT_TIMEOUT_MS });

    return new OpenAICompatibleLanguageModel({
      apiKey,
      model,
      maxTokens,
      timeoutMs,
      ...(baseUrl !== undefined ? { baseUrl } : {}),
    });
  }

  async generate({ prompt }: LanguageModelInput): Promise<LanguageModelOutput> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    // Observability only: the model name and the request bounds are safe to
    // log; the prompt and the response text are NEVER logged.
    logEvent({
      event: 'model_call_started',
      fields: { model: this.name, maxTokens: this.maxTokens, timeoutMs: this.timeoutMs },
    });
    const stopModelTimer = startTimer();

    try {
      let response: ModelResponse;
      try {
        response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            temperature: 0,
            max_tokens: this.maxTokens,
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: controller.signal,
        });
      } catch (err) {
        // An abort surfaces as a typed TIMEOUT; other network/DNS errors as
        // REQUEST. Neither message carries the API key.
        if (controller.signal.aborted) {
          throw new LanguageModelError(
            'TIMEOUT',
            `Request to ${this.baseUrl} timed out after ${this.timeoutMs}ms.`,
          );
        }
        throw new LanguageModelError(
          'REQUEST',
          `Request to ${this.baseUrl} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      if (!response.ok) {
        const bodySnippet = (await safeReadText(response)).slice(0, 500);
        throw new LanguageModelError(
          'REQUEST',
          `Provider returned ${response.status} ${response.statusText}. Body: ${bodySnippet}`,
        );
      }

      const text = extractContent(await safeReadJson(response));
      if (text === undefined || text.trim() === '') {
        // A body read cut short by the timeout looks like empty content; report
        // it as the timeout it actually was.
        if (controller.signal.aborted) {
          throw new LanguageModelError(
            'TIMEOUT',
            `Request to ${this.baseUrl} timed out after ${this.timeoutMs}ms.`,
          );
        }
        throw new LanguageModelError(
          'INVALID_RESPONSE',
          'Provider response did not contain text content at choices[0].message.content.',
        );
      }

      logEvent({
        event: 'model_call_completed',
        fields: { model: this.name, durationMs: stopModelTimer() },
      });
      return { text };
    } catch (err) {
      // Log the failure with the error's type/code only — never its message,
      // which can quote the provider's response body (raw model output).
      logEvent({
        event: 'model_call_failed',
        level: 'error',
        fields: { model: this.name, durationMs: stopModelTimer(), ...describeErrorForLog(err) },
      });
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Reads a trimmed env var, treating an unset or blank value as absent. */
function readEnv({ env, key }: { env: NodeJS.ProcessEnv; key: string }): string | undefined {
  const value = env[key]?.trim();
  return value === undefined || value === '' ? undefined : value;
}

/**
 * Reads an optional positive-integer env var, falling back when unset/blank and
 * failing closed (CONFIG) on a clearly invalid value. The var names here are
 * not secrets, so echoing the bad value is safe and helpful.
 */
function readPositiveIntEnv({
  env,
  key,
  fallback,
}: {
  env: NodeJS.ProcessEnv;
  key: string;
  fallback: number;
}): number {
  const raw = env[key]?.trim();
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new LanguageModelError(
      'CONFIG',
      `Environment variable ${key} must be a positive integer, but got "${raw}".`,
    );
  }
  return value;
}

async function safeReadText(response: ModelResponse): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '<unreadable response body>';
  }
}

async function safeReadJson(response: ModelResponse): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function extractContent(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return undefined;
  const message = (choices[0] as { message?: unknown }).message;
  if (typeof message !== 'object' || message === null) return undefined;
  const content = (message as { content?: unknown }).content;
  return typeof content === 'string' ? content : undefined;
}
