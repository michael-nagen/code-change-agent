/**
 * Vercel serverless entry point for the UI v0 shell.
 *
 * Vercel is serverless, so there is no long-lived `node:http` server. Instead we
 * build the same request listener used by `createUiServer` once at module scope
 * and delegate every invocation to it. Keeping the listener (and its in-memory
 * `UiSessionStore`) at module scope means a warm lambda reuses analyzed
 * artifacts across requests; a cold start simply gets a fresh store.
 *
 * Mode selection mirrors `src/ui/main.ts`: default to MOCK/DEMO so the deploy
 * runs with zero AI configuration, and opt into the real engine with
 * `UI_MODE=real` plus the OpenAI env vars (set in the Vercel project settings).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolveMemoryStore } from '../src/index.js';
import { createUiRequestListener, resolveEngine } from '../src/ui/index.js';
import {
  resolveTelegramConfig,
  createTelegramWebhookHandler,
  DefaultTelegramWorkflowBridge,
  type TelegramWebhookHandler,
  type TelegramSourceDefaults,
} from '../src/telegram/index.js';

// One shared store for both the runner (memory read on a run) and the memory
// handlers (save/clear/edit/status). Note: on serverless the default file store
// lives on an ephemeral/read-only FS, so memory does not persist across cold
// starts — set MEMORY_STORE=memory or a writable MEMORY_DATA_DIR to control it.
// Sharing one instance keeps a warm lambda internally consistent regardless.
//
// The engine (runner, mode, edit/refinement skills, and — in real mode —
// configured Notion/GitHub connectors) is built by the SAME shared factory the
// local server uses, so production and local cannot drift.
const memoryStore = resolveMemoryStore();
const engine = resolveEngine(memoryStore);

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
 * Build the Telegram webhook handler when configured; otherwise leave it off.
 * Telegram drives the SAME analysis workflow through a bridge over the shared
 * runner, so it never duplicates engine logic.
 */
function resolveTelegram(): TelegramWebhookHandler | undefined {
  const resolved = resolveTelegramConfig();
  if (!resolved.enabled || resolved.config === undefined) return undefined;
  const bridge = new DefaultTelegramWorkflowBridge({
    runner: engine.runner,
    mode: engine.mode,
    memoryStore,
    defaults: telegramSourceDefaults(),
    notionWriteBack: engine.notionWriteBack,
  });
  return createTelegramWebhookHandler({ config: resolved.config, memoryStore, bridge });
}

const telegram = resolveTelegram();
const listener = createUiRequestListener({
  ...engine,
  memoryStore,
  ...(telegram !== undefined ? { telegram } : {}),
});

/**
 * `@vercel/node` reads the request stream and exposes the parsed value on
 * `req.body` before our handler runs, so the underlying `'data'`/`'end'` events
 * never fire for our stream-based body reader. Re-emit the (re-serialized) body
 * on the next tick — after the handler has attached its listeners — so the
 * shared routing logic can read it exactly as it would for a raw `node:http`
 * request.
 */
function replayParsedBody(req: IncomingMessage): void {
  const parsed = (req as IncomingMessage & { body?: unknown }).body;
  if (parsed === undefined || parsed === null) {
    process.nextTick(() => req.emit('end'));
    return;
  }
  const raw =
    typeof parsed === 'string'
      ? parsed
      : Buffer.isBuffer(parsed)
        ? parsed.toString('utf8')
        : JSON.stringify(parsed);
  process.nextTick(() => {
    if (raw !== '') {
      req.emit('data', Buffer.from(raw, 'utf8'));
    }
    req.emit('end');
  });
}

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  const method = req.method ?? 'GET';
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    replayParsedBody(req);
  }
  listener(req, res);
}
