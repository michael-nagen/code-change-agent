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
  DefaultIntentRouter,
} from '../telegram/index.js';
import type { TelegramWebhookHandler, TelegramSourceDefaults } from '../telegram/index.js';
import { DefaultWorkRequestIntentSkill } from '../skills/workRequestIntent/index.js';
import type { ArtifactTextEditSkill } from '../skills/artifactTextEdit/index.js';
import type { LanguageModel } from '../index.js';
import {
  JsonFileVideoStore,
  MockYouTubeVideoSearch,
  VideoLibraryService,
  YouTubeApiVideoSearch,
  runDailyVideoTick,
  seedVideos,
} from '../videos/index.js';
import { HttpTelegramApi } from '../telegram/HttpTelegramApi.js';
import type { TelegramConfig } from '../telegram/index.js';
import { formatVideoMessage } from '../telegram/handlers/videoCommands.js';

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
/**
 * The durable video library used by the Telegram video commands and the daily
 * send. Real YouTube discovery only when YOUTUBE_API_KEY is set; otherwise a
 * clearly-labeled mock provider keeps /refresh_videos demonstrable.
 */
function resolveVideoLibrary(): VideoLibraryService {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  const search =
    apiKey !== undefined && apiKey !== ''
      ? new YouTubeApiVideoSearch({ apiKey })
      : new MockYouTubeVideoSearch();
  const library = new VideoLibraryService({ store: new JsonFileVideoStore(), search });
  // First run only: bootstrap the empty on-disk library with the seed list.
  void library.seedIfEmpty(seedVideos()).catch(() => undefined);
  return library;
}

/**
 * Opt-in daily video send (DAILY_VIDEO_ENABLED=true): a periodic tick that
 * delivers at most one video per calendar day to the FIRST configured allowed
 * chat id — never to anyone else. Failures are logged and not retried until
 * the next day; ticks are cheap (a small JSON read) between sends.
 */
function maybeStartDailyVideoSend({
  videoLibrary,
  config,
}: {
  videoLibrary: VideoLibraryService;
  config: TelegramConfig;
}): void {
  if (process.env.DAILY_VIDEO_ENABLED !== 'true') return;
  const chatId = config.allowedChatIds[0];
  if (chatId === undefined) {
    // eslint-disable-next-line no-console
    console.log('[videos] DAILY_VIDEO_ENABLED is set but TELEGRAM_ALLOWED_CHAT_IDS is empty — daily send disabled.');
    return;
  }
  const sendTime = process.env.DAILY_VIDEO_TIME?.trim() || '09:00';
  const api = new HttpTelegramApi({ botToken: config.botToken });
  const tick = async (): Promise<void> => {
    const outcome = await runDailyVideoTick({
      videoLibrary,
      deliver: async (video) => {
        await api.sendMessage({ chatId, text: formatVideoMessage(video) });
      },
      now: new Date(),
      sendTime,
    });
    if (outcome === 'sent' || outcome === 'failed' || outcome === 'empty') {
      // eslint-disable-next-line no-console
      console.log(`[videos] daily send: ${outcome}`);
    }
  };
  const timer = setInterval(() => void tick().catch(() => undefined), 5 * 60 * 1000);
  timer.unref();
  // eslint-disable-next-line no-console
  console.log(`[videos] daily video send enabled (after ${sendTime}, first allowed chat).`);
}

function resolveTelegram({
  memoryStore,
  runner,
  mode,
  notionWriteBack,
  artifactTextEditSkill,
  languageModel,
  videoLibrary,
}: {
  memoryStore: MemoryStore;
  runner: AnalysisRunner;
  mode: UiMode;
  notionWriteBack: NotionWriteBackService;
  artifactTextEditSkill: ArtifactTextEditSkill;
  languageModel?: LanguageModel;
  videoLibrary: VideoLibraryService;
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
    artifactTextEditSkill,
  });
  // Natural-language routing uses the LLM intent skill when a model is available
  // (real mode); otherwise the service falls back to its keyword heuristic.
  const intentRouter =
    languageModel !== undefined
      ? new DefaultIntentRouter(new DefaultWorkRequestIntentSkill(languageModel))
      : undefined;
  maybeStartDailyVideoSend({ videoLibrary, config: resolved.config });
  return createTelegramWebhookHandler({
    config: resolved.config,
    memoryStore,
    bridge,
    videoLibrary,
    ...(intentRouter !== undefined ? { intentRouter } : {}),
  });
}

function main(): void {
  const port = Number(process.env.PORT ?? 5173);
  // Durable developer memory (JSON file store by default; see resolveMemoryStore).
  const memoryStore = resolveMemoryStore();
  const {
    runner,
    mode,
    artifactEditSkill,
    artifactTextEditSkill,
    guidanceRefinementSkill,
    notionWriteBack,
    languageModel,
  } = resolveEngine(memoryStore);
  const videoLibrary = resolveVideoLibrary();
  const telegram = resolveTelegram({
    memoryStore,
    runner,
    mode,
    notionWriteBack,
    artifactTextEditSkill,
    videoLibrary,
    ...(languageModel !== undefined ? { languageModel } : {}),
  });
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
