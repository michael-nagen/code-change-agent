/**
 * Assemble the Telegram webhook handler from resolved config + the shared
 * MemoryStore. This is the single place the pieces are wired, so the HTTP layer
 * only sees a tiny `handle({ update, secretHeader })` surface and stays free of
 * Telegram internals. The Telegram API client (network) is injectable for tests.
 */
import type { MemoryStore } from '../memory/index.js';
import { HttpTelegramApi, type TelegramFetch } from './HttpTelegramApi.js';
import { TelegramCommandService } from './TelegramCommandService.js';
import { handleTelegramWebhook } from './handleTelegramWebhook.js';
import { InMemoryTelegramArtifactRegistry } from './TelegramArtifactRegistry.js';
import type { IntentRouter } from './IntentRouter.js';
import type { TelegramWorkflowBridge } from './TelegramWorkflowBridge.js';
import type { VideoLibraryService } from '../videos/index.js';
import type {
  TelegramApi,
  TelegramArtifactRegistry,
  TelegramConfig,
  TelegramStateStore,
  TelegramWebhookResult,
} from './types.js';

export interface TelegramWebhookHandler {
  handle(input: { update: unknown; secretHeader?: string }): Promise<TelegramWebhookResult>;
}

export function createTelegramWebhookHandler({
  config,
  memoryStore,
  userId,
  bridge,
  stateStore,
  intentRouter,
  videoLibrary,
  registry,
  api,
  fetchImpl,
}: {
  config: TelegramConfig;
  memoryStore: MemoryStore;
  userId?: string;
  /** The workflow adapter that drives analysis/generation/memory writes. */
  bridge?: TelegramWorkflowBridge;
  /** Per-chat control state store. Defaults to an in-memory one. */
  stateStore?: TelegramStateStore;
  /** Routes free-text messages to a command. Defaults to heuristic-only. */
  intentRouter?: IntentRouter;
  /** Daily AI Video library; wire the file-backed one for durability. */
  videoLibrary?: VideoLibraryService;
  /** Maps sent message ids → artifacts for reply-to-edit. Defaults in-memory. */
  registry?: TelegramArtifactRegistry;
  /** Provide a custom API (tests). Defaults to the real HTTP Telegram client. */
  api?: TelegramApi;
  fetchImpl?: TelegramFetch;
}): TelegramWebhookHandler {
  const service = new TelegramCommandService({
    memoryStore,
    config,
    ...(userId !== undefined ? { userId } : {}),
    ...(bridge !== undefined ? { bridge } : {}),
    ...(stateStore !== undefined ? { stateStore } : {}),
    ...(intentRouter !== undefined ? { intentRouter } : {}),
    ...(videoLibrary !== undefined ? { videoLibrary } : {}),
  });
  const telegramApi =
    api ??
    new HttpTelegramApi({
      botToken: config.botToken,
      ...(fetchImpl !== undefined ? { fetchImpl } : {}),
    });
  const artifactRegistry = registry ?? new InMemoryTelegramArtifactRegistry();

  return {
    handle({ update, secretHeader }) {
      return handleTelegramWebhook({
        update,
        config,
        service,
        api: telegramApi,
        registry: artifactRegistry,
        ...(secretHeader !== undefined ? { secretHeader } : {}),
      });
    },
  };
}
