/**
 * UI v0 entry point.
 *
 * Defaults to MOCK/DEMO mode so the shell runs with zero AI configuration and
 * never emits output that could be mistaken for real AI.
 *
 * Opt into the real engine with `UI_MODE=real`. That path builds the official
 * V2 `AnalysisHarness` from the existing `OpenAICompatibleLanguageModel` (via
 * its own `fromEnv()` — this file does not implement or modify the provider).
 * Real mode therefore requires the same env as `npm run smoke:real-ai`
 * (OPENAI_API_KEY, OPENAI_MODEL, optional OPENAI_BASE_URL).
 */
import { resolveMemoryStore } from '../index.js';
import type { MemoryStore } from '../index.js';
import type { AnalysisRunner, UiMode } from './types.js';
import { resolveEngine } from './resolveEngine.js';
import { createUiServer } from './server.js';
import type { NotionWriteBackService } from '../notion/index.js';
import {
  resolveTelegramConfig,
  createTelegramWebhookHandler,
  DefaultTelegramWorkflowBridge,
} from '../telegram/index.js';
import type { TelegramWebhookHandler, TelegramSourceDefaults } from '../telegram/index.js';

/** Configured default sources Telegram may fall back to (read straight from env). */
function telegramSourceDefaults(): TelegramSourceDefaults {
  const githubPrUrl = process.env.GITHUB_DEFAULT_PR_URL?.trim();
  const notionPageId = process.env.NOTION_DEFAULT_PAGE_ID?.trim();
  return {
    ...(githubPrUrl !== undefined && githubPrUrl !== '' ? { githubPrUrl } : {}),
    ...(notionPageId !== undefined && notionPageId !== '' ? { notionPageId } : {}),
  };
}

/**
 * Build the Telegram webhook handler when a bot token is configured. Telegram is
 * a thin interface over the SAME memory store and analysis workflow the UI uses:
 * a `DefaultTelegramWorkflowBridge` wraps the shared runner so Telegram drives
 * the same engine without duplicating logic. Returns undefined (and the route
 * stays 404) when Telegram is not configured.
 */
function resolveTelegram({
  memoryStore,
  runner,
  mode,
  notionWriteBack,
}: {
  memoryStore: MemoryStore;
  runner: AnalysisRunner;
  mode: UiMode;
  notionWriteBack: NotionWriteBackService;
}): TelegramWebhookHandler | undefined {
  const resolved = resolveTelegramConfig();
  for (const warning of resolved.warnings) {
    // eslint-disable-next-line no-console
    console.log(`[telegram] ${warning}`);
  }
  if (!resolved.enabled || resolved.config === undefined) {
    return undefined;
  }
  const bridge = new DefaultTelegramWorkflowBridge({
    runner,
    mode,
    memoryStore,
    defaults: telegramSourceDefaults(),
    notionWriteBack,
  });
  return createTelegramWebhookHandler({ config: resolved.config, memoryStore, bridge });
}

function main(): void {
  const port = Number(process.env.PORT ?? 5173);
  // Durable developer memory (JSON file store by default; see resolveMemoryStore).
  const memoryStore = resolveMemoryStore();
  const { runner, mode, artifactEditSkill, guidanceRefinementSkill, notionWriteBack } =
    resolveEngine(memoryStore);
  const telegram = resolveTelegram({ memoryStore, runner, mode, notionWriteBack });
  const server = createUiServer({
    runner,
    mode,
    artifactEditSkill,
    guidanceRefinementSkill,
    memoryStore,
    notionWriteBack,
    ...(telegram !== undefined ? { telegram } : {}),
  });

  server.listen(port, () => {
    const tag = mode === 'mock' ? 'MOCK/DEMO (fake data)' : 'REAL engine';
    // eslint-disable-next-line no-console
    console.log(`UI v0 running at http://localhost:${port}  [${tag}, runner=${runner.name}]`);
    if (mode === 'mock') {
      // eslint-disable-next-line no-console
      console.log('Set UI_MODE=real (with OpenAI env vars) to use the real analysis engine.');
    }
    if (telegram !== undefined) {
      // eslint-disable-next-line no-console
      console.log('Telegram webhook enabled at POST /api/telegram.');
    }
  });
}

main();
