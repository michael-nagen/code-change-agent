import { LanguageModelError } from '../errors/LanguageModelError.js';
import type { LanguageModel, LanguageModelInput, LanguageModelOutput } from './LanguageModel.js';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

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
}

/**
 * A concrete LanguageModel backed by any OpenAI-compatible Chat Completions
 * endpoint, using the global `fetch` (no SDK dependency). Skills depend only on
 * the LanguageModel interface, so this provider is fully swappable.
 */
export class OpenAICompatibleLanguageModel implements LanguageModel {
  readonly name: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor({ apiKey, model, baseUrl }: OpenAICompatibleConfig) {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = (baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.name = `openai-compatible:${model}`;
  }

  /**
   * Reads configuration from the environment and fails clearly when required
   * variables are missing. Never logs or echoes the API key.
   *
   * - OPENAI_API_KEY  (required)
   * - OPENAI_MODEL    (required)
   * - OPENAI_BASE_URL (optional; defaults to the OpenAI public endpoint)
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

    return new OpenAICompatibleLanguageModel({
      apiKey,
      model,
      ...(baseUrl !== undefined ? { baseUrl } : {}),
    });
  }

  async generate({ prompt }: LanguageModelInput): Promise<LanguageModelOutput> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
    } catch (err) {
      // Network/DNS/abort errors. The message carries no credentials.
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
      throw new LanguageModelError(
        'INVALID_RESPONSE',
        'Provider response did not contain text content at choices[0].message.content.',
      );
    }

    return { text };
  }
}

/** Reads a trimmed env var, treating an unset or blank value as absent. */
function readEnv({ env, key }: { env: NodeJS.ProcessEnv; key: string }): string | undefined {
  const value = env[key]?.trim();
  return value === undefined || value === '' ? undefined : value;
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '<unreadable response body>';
  }
}

async function safeReadJson(response: Response): Promise<unknown> {
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
