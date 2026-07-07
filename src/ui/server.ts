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
import { MockArtifactEditSkill } from '../skills/mocks/index.js';
import { handleAnalyze } from './handleAnalyze.js';
import { handleChatEdit, handleUndoArtifactEdit } from './handleChatEdit.js';
import { handleSaveMemory } from './handleSaveMemory.js';
import { UiSessionStore } from './sessionStore.js';
import { renderPage } from './page.js';
import { InMemoryMemoryStore } from '../memory/index.js';
import type { MemoryStore } from '../memory/index.js';

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
  memoryStore?: MemoryStore;
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
  memoryStore = new InMemoryMemoryStore(),
}: {
  runner: AnalysisRunner;
  mode: UiMode;
  artifactEditSkill?: ArtifactEditSkill;
  memoryStore?: MemoryStore;
}): (req: IncomingMessage, res: ServerResponse) => void {
  const store = new UiSessionStore();
  return (req, res) => {
    void handleRequest({ req, res, runner, mode, artifactEditSkill, memoryStore, store });
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
  memoryStore,
  store,
}: {
  req: IncomingMessage;
  res: ServerResponse;
  runner: AnalysisRunner;
  mode: UiMode;
  artifactEditSkill: ArtifactEditSkill;
  memoryStore: MemoryStore;
  store: UiSessionStore;
}): Promise<void> {
  const method = req.method ?? 'GET';
  const url = req.url ?? '/';
  const path = url.split('?')[0] ?? '/';

  if (method === 'GET' && (path === '/' || path === '/index.html')) {
    sendHtml(res, 200, renderPage({ mode }));
    return;
  }

  if (method === 'POST' && path === '/api/analyze') {
    const parsed = await readJsonBody(req);
    if (!parsed.ok) {
      sendJson(res, 400, { status: 'error', mode, message: 'Request body must be valid JSON.' });
      return;
    }
    const response = await handleAnalyze({ runner, mode, body: parsed.value, store });
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

  sendJson(res, 404, { status: 'error', mode, message: `Not found: ${method} ${path}` });
}
