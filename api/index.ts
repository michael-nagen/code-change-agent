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
import {
  AnalysisHarness,
  OpenAICompatibleLanguageModel,
  DefaultArtifactEditSkill,
  MockArtifactEditSkill,
  type ArtifactEditSkill,
} from '../src/index.js';
import {
  createUiRequestListener,
  HarnessAnalysisRunner,
  MockAnalysisRunner,
  type AnalysisRunner,
  type UiMode,
} from '../src/ui/index.js';

function resolveRunner(): {
  runner: AnalysisRunner;
  mode: UiMode;
  artifactEditSkill: ArtifactEditSkill;
} {
  if (process.env.UI_MODE === 'real') {
    const model = OpenAICompatibleLanguageModel.fromEnv();
    const harness = new AnalysisHarness({ model });
    return {
      runner: new HarnessAnalysisRunner(harness),
      mode: 'real',
      artifactEditSkill: new DefaultArtifactEditSkill(model),
    };
  }
  return {
    runner: new MockAnalysisRunner(),
    mode: 'mock',
    artifactEditSkill: new MockArtifactEditSkill(),
  };
}

const listener = createUiRequestListener(resolveRunner());

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
