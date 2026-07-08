/**
 * Lightweight structured observability for analysis runs and agent steps.
 *
 * Goals: make every run and important step traceable (one `traceId` per run),
 * with structured lifecycle events and per-step timing — without changing any
 * product behavior. This is a thin wrapper over `console`, not a framework.
 *
 * Trace propagation uses `AsyncLocalStorage` so a `traceId` set once at the top
 * of a run flows into deeply-nested async calls (workflow steps, model calls,
 * memory, self-critique) WITHOUT threading a parameter through every function.
 *
 * Safety is a first-class concern (see `sanitizeFields`): events are meant to
 * be safe to show in a demo. Secrets and raw source content (API keys, tokens,
 * prompts, model responses, diffs, specs, Notion/GitHub text) are dropped by an
 * explicit key denylist, and every string is length-capped so nothing large can
 * leak in by accident. Callers should still only pass safe, scalar fields.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

/** The lifecycle events we emit. Kept as a closed union so names stay stable. */
export type ObservabilityEventName =
  | 'run_started'
  | 'run_completed'
  | 'run_failed'
  | 'step_started'
  | 'step_completed'
  | 'step_failed'
  | 'step_skipped_cached'
  | 'model_call_started'
  | 'model_call_completed'
  | 'model_call_failed'
  | 'memory_loaded'
  | 'memory_saved'
  | 'self_critique_started'
  | 'self_critique_completed'
  | 'refinement_started'
  | 'refinement_completed'
  | 'notion_write_back';

export type LogLevel = 'info' | 'warn' | 'error';

/** The context carried for the lifetime of a run and stamped onto every event. */
export interface TraceContext {
  traceId: string;
  sessionId?: string;
  projectId?: string;
}

/** A structured log record after trace context is merged and fields sanitized. */
export interface ObservabilityRecord {
  ts: string;
  level: LogLevel;
  event: ObservabilityEventName;
  [key: string]: unknown;
}

/** Where records go. Swappable so tests can capture events without stdout. */
export type ObservabilitySink = (record: ObservabilityRecord) => void;

/** Max length for any logged string, so large content can never leak in. */
const MAX_STRING_LENGTH = 200;

/**
 * Exact field names (compared lowercased) that must never be logged. Substring
 * matching is deliberately avoided so safe fields like `maxTokens` are kept.
 */
const REDACTED_KEYS = new Set(
  [
    'apiKey',
    'api_key',
    'authorization',
    'auth',
    'token',
    'tokens',
    'secret',
    'password',
    'prompt',
    'prompts',
    'response',
    'responses',
    'text',
    'content',
    'body',
    'diff',
    'rawDiff',
    'rawText',
    'requirementText',
    'spec',
    'specOrChecklist',
    'notionText',
    'githubText',
    'memoryJson',
    'memory_json',
    'connectionString',
    'databaseUrl',
    'database_url',
  ].map((k) => k.toLowerCase()),
);

const REDACTED_PLACEHOLDER = '[redacted]';

const traceStore = new AsyncLocalStorage<TraceContext>();

const defaultSink: ObservabilitySink = (record) => {
  const line = safeStringify(record);
  if (record.level === 'error') {
    console.error(line);
  } else if (record.level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
};

let currentSink: ObservabilitySink = defaultSink;

/** Generate a fresh trace/run id. */
export function newTraceId(): string {
  return randomUUID();
}

/**
 * Run `fn` inside a trace context so every `logEvent` within it (however deeply
 * nested and across `await`s) is stamped with the same `traceId`.
 */
export function runWithTrace<T>(seed: TraceContext, fn: () => T): T {
  // A fresh object per run; `updateTraceContext` mutates it in place so late-
  // discovered fields (e.g. sessionId) apply to subsequent events in the run.
  return traceStore.run({ ...seed }, fn);
}

/** The current trace context, or an empty object outside any run. */
export function getTraceContext(): Partial<TraceContext> {
  return traceStore.getStore() ?? {};
}

/** Merge fields into the active trace context (e.g. set sessionId once known). */
export function updateTraceContext(patch: Partial<TraceContext>): void {
  const store = traceStore.getStore();
  if (store === undefined) return;
  Object.assign(store, patch);
}

/**
 * Emit one structured event. Trace context is merged first, then the caller's
 * fields (sanitized), so callers cannot accidentally overwrite the traceId with
 * unsanitized input. `level` defaults to 'info'.
 */
export function logEvent({
  event,
  level = 'info',
  fields = {},
}: {
  event: ObservabilityEventName;
  level?: LogLevel;
  fields?: Record<string, unknown>;
}): void {
  const context = getTraceContext();
  const record: ObservabilityRecord = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(sanitizeValue(context, 0) as Record<string, unknown>),
    ...(sanitizeValue(fields, 0) as Record<string, unknown>),
  };
  currentSink(record);
}

/** Start a timer; the returned function yields elapsed milliseconds (rounded). */
export function startTimer(): () => number {
  const start = performance.now();
  return () => Math.round(performance.now() - start);
}

/** Swap the sink (tests). Returns the previous sink so it can be restored. */
export function setObservabilitySink(sink: ObservabilitySink): ObservabilitySink {
  const previous = currentSink;
  currentSink = sink;
  return previous;
}

/** Restore the default console-backed sink. */
export function resetObservabilitySink(): void {
  currentSink = defaultSink;
}

/**
 * Recursively drop denylisted keys and cap string lengths. Depth is bounded so
 * a cyclic or huge object can never blow up logging. This is a safety net; the
 * primary guarantee is that callers only pass safe fields.
 */
function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > 4) return '[depth-limited]';
  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}…[+${value.length - MAX_STRING_LENGTH} chars]`
      : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (REDACTED_KEYS.has(key.toLowerCase())) {
        out[key] = REDACTED_PLACEHOLDER;
        continue;
      }
      out[key] = sanitizeValue(val, depth + 1);
    }
    return out;
  }
  return value;
}

function safeStringify(record: ObservabilityRecord): string {
  try {
    return JSON.stringify(record);
  } catch {
    return JSON.stringify({ ts: record.ts, level: record.level, event: record.event });
  }
}

/**
 * Describe an error for logging WITHOUT leaking its message (provider error
 * bodies can quote raw prompts/responses). Only the error's class name and, for
 * errors that carry a safe `code`, that code are surfaced.
 */
export function describeErrorForLog(err: unknown): { errorName: string; errorCode?: string } {
  if (err instanceof Error) {
    const code = (err as { code?: unknown }).code;
    return {
      errorName: err.name,
      ...(typeof code === 'string' ? { errorCode: code } : {}),
    };
  }
  return { errorName: 'UnknownError' };
}
