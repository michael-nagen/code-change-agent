/**
 * The context every Telegram command handler receives, plus shared, pure helpers
 * for resolving the active project and loading its memory.
 *
 * Handlers are thin and side-effect-light: they read the injected `memoryStore`,
 * delegate all analysis/generation/memory writes to the `bridge` (which calls the
 * UI's server handlers), read/write only lightweight per-chat control `state`, and
 * report progress through the injected `progress` callback (wired to the adapter
 * by the webhook). They never talk to Telegram directly and run no LLM logic.
 */
import type { MemoryStore, ProjectMemory } from '../../memory/index.js';
import { toMemoryProjectId } from '../../memory/index.js';
import { MemoryStoreError } from '../../errors/MemoryStoreError.js';
import type { IntentRouter } from '../IntentRouter.js';
import type { TelegramWorkflowBridge } from '../TelegramWorkflowBridge.js';
import type { VideoLibraryService } from '../../videos/index.js';
import type { TelegramConfig, TelegramReply, TelegramStateStore } from '../types.js';

export interface HandlerContext {
  /** Raw remainder after the command, spacing preserved. */
  argsText: string;
  /** Whitespace tokens of `argsText`. */
  args: string[];
  chatId: number | string;
  userId: string;
  config: TelegramConfig;
  memoryStore: MemoryStore;
  /** Absent → generation/save/clear report unavailable. */
  bridge: TelegramWorkflowBridge | undefined;
  /** The Daily AI Video library (defaults to an in-memory seeded one). */
  videos: VideoLibraryService;
  state: TelegramStateStore;
  intentRouter: IntentRouter | undefined;
  /**
   * Show/refresh a status line before slow work (e.g. "🔄 Running analysis…").
   * The webhook renders the first call as a message and edits it thereafter; a
   * no-op transport is provided in tests.
   */
  progress: (text: string) => Promise<void>;
}

export type CommandHandler = (ctx: HandlerContext) => Promise<TelegramReply>;

/** A registered command: its name, one-line help summary, and handler. */
export interface CommandSpec {
  command: string;
  summary: string;
  handle: CommandHandler;
}

/** Resolve a project from explicit args → chat state → configured default. */
export function resolveProject(
  ctx: HandlerContext,
  argsTextOverride?: string,
): { label: string; projectId: string } | undefined {
  const explicit = (argsTextOverride ?? ctx.argsText).trim();
  const label =
    explicit !== ''
      ? explicit
      : (ctx.state.get(ctx.chatId).activeProject ?? ctx.config.defaultProject);
  if (label === undefined || label.trim() === '') return undefined;
  const projectId = toMemoryProjectId(label);
  if (projectId === undefined) return undefined;
  return { label, projectId };
}

export function currentProjectLabel(ctx: HandlerContext): string | undefined {
  const label = ctx.state.get(ctx.chatId).activeProject ?? ctx.config.defaultProject;
  return label !== undefined && label.trim() !== '' ? label : undefined;
}

/** Load project memory, or a user-facing error string on failure. */
export async function loadProjectMemory(
  ctx: HandlerContext,
  projectId: string,
): Promise<ProjectMemory | undefined | string> {
  try {
    return await ctx.memoryStore.getProjectMemory({ userId: ctx.userId, projectId });
  } catch (err) {
    return `Could not read memory: ${errorText(err)}`;
  }
}

export function noProjectMessage(): string {
  return 'No project specified. Send e.g. "/status my-project", set an active project with "/project <name>", or set TELEGRAM_DEFAULT_PROJECT.';
}

export function errorText(err: unknown): string {
  return err instanceof MemoryStoreError ? err.message : String(err);
}
