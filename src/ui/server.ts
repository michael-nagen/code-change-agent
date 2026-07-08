/**
 * A tiny, dependency-free HTTP server for the UI v0 shell.
 *
 * Routes:
 *   GET  /            -> the single-page HTML shell
 *   POST /api/analyze -> runs the analysis handler, returns AnalyzeResponse JSON
 *
 * It uses only `node:http`; there is no framework and no build step. The runner
 * (real harness or mock) and mode are injected so this file stays free of any
 * provider wiring.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AnalysisRunner, UiMode } from './types.js';
import type { ArtifactEditSkill } from '../skills/artifactEdit/index.js';
import { MockArtifactEditSkill, MockGuidanceRefinementSkill } from '../skills/mocks/index.js';
import type { GuidanceRefinementSkill } from '../skills/dailyWorkGuidanceRefinement/index.js';
import { handleAnalyze } from './handleAnalyze.js';
import { handleChatEdit, handleUndoArtifactEdit } from './handleChatEdit.js';
import { handleSaveMemory } from './handleSaveMemory.js';
import { handleApplyDecisions } from './handleApplyDecisions.js';
import { handleClearMemory } from './handleClearMemory.js';
import { handleEditMemory } from './handleEditMemory.js';
import { handleWriteNotion } from './handleWriteNotion.js';
import { UiSessionStore } from './sessionStore.js';
import { renderPage } from './page.js';
import { InMemoryMemoryStore } from '../memory/index.js';
import type { MemoryStore } from '../memory/index.js';
import type { NotionWriteBackService } from '../notion/index.js';
import type { TelegramWebhookHandler } from '../telegram/index.js';

const MAX_BODY_BYTES = 5 * 1024 * 1024;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error('Request body too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function sendHtml(res: ServerResponse, status: number, html: string): void {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

/** Normalize a possibly-array HTTP header value to its first string, if any. */
function firstHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Build (but do not start) the UI server with an injected runner + mode.
 *
 * `artifactEditSkill` powers the side-chat editing endpoints. It defaults to a
 * provider-free demo skill so the server stays free of provider wiring; real
 * mode injects an LLM-backed skill. A single in-memory `UiSessionStore` is
 * shared across requests so chat edits reuse analyzed artifacts.
 */
export function createUiServer(options: {
  runner: AnalysisRunner;
  mode: UiMode;
  artifactEditSkill?: ArtifactEditSkill;
  guidanceRefinementSkill?: GuidanceRefinementSkill;
  memoryStore?: MemoryStore;
  notionWriteBack?: NotionWriteBackService;
  telegram?: TelegramWebhookHandler;
}): Server {
  return createServer(createUiRequestListener(options));
}

/**
 * Build a bare request listener `(req, res) => void` sharing the routing logic
 * above. This lets non-`node:http` hosts (e.g. a Vercel serverless function)
 * reuse the exact same handlers without spinning up their own `Server`.
 *
 * A single `UiSessionStore` is captured in the closure, so as long as the
 * listener instance is reused (e.g. a warm serverless lambda) chat edits keep
 * seeing previously analyzed artifacts.
 */
export function createUiRequestListener({
  runner,
  mode,
  artifactEditSkill = new MockArtifactEditSkill(),
  guidanceRefinementSkill = new MockGuidanceRefinementSkill(),
  memoryStore = new InMemoryMemoryStore(),
  notionWriteBack,
  telegram,
}: {
  runner: AnalysisRunner;
  mode: UiMode;
  artifactEditSkill?: ArtifactEditSkill;
  guidanceRefinementSkill?: GuidanceRefinementSkill;
  memoryStore?: MemoryStore;
  notionWriteBack?: NotionWriteBackService;
  telegram?: TelegramWebhookHandler;
}): (req: IncomingMessage, res: ServerResponse) => void {
  const store = new UiSessionStore();
  return (req, res) => {
    void handleRequest({
      req,
      res,
      runner,
      mode,
      artifactEditSkill,
      guidanceRefinementSkill,
      memoryStore,
      store,
      ...(notionWriteBack !== undefined ? { notionWriteBack } : {}),
      ...(telegram !== undefined ? { telegram } : {}),
    });
  };
}

/** Parse a request body as JSON, returning a typed marker on failure. */
async function readJsonBody(req: IncomingMessage): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    const raw = await readBody(req);
    return { ok: true, value: raw.trim() === '' ? {} : JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

/** Match `/api/sessions/:sessionId/:action`, returning its parts or null. */
function matchSessionRoute(path: string): { sessionId: string; action: string } | null {
  const parts = path.split('/');
  if (parts.length === 5 && parts[1] === 'api' && parts[2] === 'sessions') {
    const sessionId = decodeURIComponent(parts[3] ?? '');
    const action = parts[4] ?? '';
    if (sessionId !== '' && action !== '') {
      return { sessionId, action };
    }
  }
  return null;
}

async function handleRequest({
  req,
  res,
  runner,
  mode,
  artifactEditSkill,
  guidanceRefinementSkill,
  memoryStore,
  store,
  notionWriteBack,
  telegram,
}: {
  req: IncomingMessage;
  res: ServerResponse;
  runner: AnalysisRunner;
  mode: UiMode;
  artifactEditSkill: ArtifactEditSkill;
  guidanceRefinementSkill: GuidanceRefinementSkill;
  memoryStore: MemoryStore;
  store: UiSessionStore;
  notionWriteBack?: NotionWriteBackService;
  telegram?: TelegramWebhookHandler;
}): Promise<void> {
  const method = req.method ?? 'GET';
  const url = req.url ?? '/';
  const path = url.split('?')[0] ?? '/';

  if (method === 'GET' && (path === '/' || path === '/index.html')) {
    sendHtml(res, 200, renderPage({ mode }));
    return;
  }

  if (method === 'POST' && path === '/api/telegram') {
    if (telegram === undefined) {
      sendJson(res, 404, { ok: false, description: 'Telegram is not configured.' });
      return;
    }
    const parsed = await readJsonBody(req);
    if (!parsed.ok) {
      sendJson(res, 400, { ok: false, description: 'Request body must be valid JSON.' });
      return;
    }
    const secretHeader = firstHeader(req.headers['x-telegram-bot-api-secret-token']);
    const result = await telegram.handle({
      update: parsed.value,
      ...(secretHeader !== undefined ? { secretHeader } : {}),
    });
    sendJson(res, result.statusCode, result.body);
    return;
  }

  if (method === 'POST' && path === '/api/analyze') {
    const parsed = await readJsonBody(req);
    if (!parsed.ok) {
      sendJson(res, 400, { status: 'error', mode, message: 'Request body must be valid JSON.' });
      return;
    }
    const response = await handleAnalyze({ runner, mode, body: parsed.value, store, memoryStore });
    sendJson(res, 200, response);
    return;
  }

  if (method === 'POST' && path === '/api/memory/edit') {
    const parsed = await readJsonBody(req);
    if (!parsed.ok) {
      sendJson(res, 400, { status: 'error', message: 'Request body must be valid JSON.' });
      return;
    }
    const response = await handleEditMemory({ memoryStore, body: parsed.value });
    sendJson(res, 200, response);
    return;
  }

  if (method === 'POST' && path === '/api/memory/clear') {
    const parsed = await readJsonBody(req);
    if (!parsed.ok) {
      sendJson(res, 400, { status: 'error', message: 'Request body must be valid JSON.' });
      return;
    }
    const response = await handleClearMemory({ memoryStore, body: parsed.value });
    sendJson(res, 200, response);
    return;
  }

  const sessionRoute = matchSessionRoute(path);
  if (method === 'POST' && sessionRoute !== null && sessionRoute.action === 'chat-edit') {
    const parsed = await readJsonBody(req);
    if (!parsed.ok) {
      sendJson(res, 400, { status: 'error', message: 'Request body must be valid JSON.' });
      return;
    }
    const response = await handleChatEdit({
      skill: artifactEditSkill,
      store,
      sessionId: sessionRoute.sessionId,
      body: parsed.value,
    });
    sendJson(res, 200, response);
    return;
  }

  if (method === 'POST' && sessionRoute !== null && sessionRoute.action === 'undo-artifact-edit') {
    const parsed = await readJsonBody(req);
    if (!parsed.ok) {
      sendJson(res, 400, { status: 'error', message: 'Request body must be valid JSON.' });
      return;
    }
    const response = handleUndoArtifactEdit({
      store,
      sessionId: sessionRoute.sessionId,
      body: parsed.value,
    });
    sendJson(res, 200, response);
    return;
  }

  if (method === 'POST' && sessionRoute !== null && sessionRoute.action === 'save-memory') {
    const parsed = await readJsonBody(req);
    if (!parsed.ok) {
      sendJson(res, 400, { status: 'error', message: 'Request body must be valid JSON.' });
      return;
    }
    const response = await handleSaveMemory({
      memoryStore,
      store,
      sessionId: sessionRoute.sessionId,
      body: parsed.value,
    });
    sendJson(res, 200, response);
    return;
  }

  if (method === 'POST' && sessionRoute !== null && sessionRoute.action === 'apply-decisions') {
    const parsed = await readJsonBody(req);
    if (!parsed.ok) {
      sendJson(res, 400, { status: 'error', message: 'Request body must be valid JSON.' });
      return;
    }
    const response = await handleApplyDecisions({
      memoryStore,
      store,
      sessionId: sessionRoute.sessionId,
      body: parsed.value,
      refinementSkill: guidanceRefinementSkill,
    });
    sendJson(res, 200, response);
    return;
  }

  if (method === 'POST' && sessionRoute !== null && sessionRoute.action === 'write-notion') {
    const parsed = await readJsonBody(req);
    if (!parsed.ok) {
      sendJson(res, 400, { status: 'error', message: 'Request body must be valid JSON.' });
      return;
    }
    const response = await handleWriteNotion({
      ...(notionWriteBack !== undefined ? { notionWriteBack } : {}),
      store,
      memoryStore,
      sessionId: sessionRoute.sessionId,
      body: parsed.value,
    });
    sendJson(res, 200, response);
    return;
  }

  sendJson(res, 404, { status: 'error', mode, message: `Not found: ${method} ${path}` });
}
