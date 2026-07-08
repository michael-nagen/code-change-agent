/**
 * Orchestrates Telegram interactions by building a handler context and delegating
 * to the command REGISTRY. It stays thin: it resolves identity/config, owns the
 * per-chat control state, and routes three kinds of input to the SAME dispatch
 * path —
 *   - slash commands (`/daily …`),
 *   - inline-button taps (callback data IS a command line),
 *   - free-text messages (routed to a command via the IntentRouter).
 *
 * It contains NO reasoning and runs NO LLM logic directly; understanding of free
 * text lives in the injected intent skill (behind the router), and all analysis /
 * generation / memory writes go through the injected workflow bridge.
 *
 * Authorization and the webhook secret are handled upstream at the webhook
 * boundary, not here.
 */
import type { MemoryStore } from '../memory/index.js';
import { resolveUserId } from '../memory/index.js';
import { plainReply } from './reply.js';
import { formatHelp } from './formatTelegramResponse.js';
import { parseTelegramCommand } from './parseTelegramCommand.js';
import { DefaultIntentRouter, type IntentRouter } from './IntentRouter.js';
import { InMemoryTelegramStateStore } from './TelegramStateStore.js';
import { dispatchCommand } from './handlers/index.js';
import { editArtifact } from './handlers/editCommands.js';
import type { HandlerContext } from './handlers/context.js';
import type { TelegramWorkflowBridge } from './TelegramWorkflowBridge.js';
import { InMemoryVideoStore, VideoLibraryService, seedVideos } from '../videos/index.js';
import type {
  TelegramArtifactRef,
  TelegramConfig,
  TelegramReply,
  TelegramStateStore,
} from './types.js';

/** A no-op progress reporter used when the caller does not supply one (tests). */
const NO_PROGRESS = async (): Promise<void> => undefined;

export class TelegramCommandService {
  private readonly memoryStore: MemoryStore;
  private readonly config: TelegramConfig;
  private readonly userId: string;
  private readonly bridge: TelegramWorkflowBridge | undefined;
  private readonly stateStore: TelegramStateStore;
  private readonly intentRouter: IntentRouter;
  private readonly videoLibrary: VideoLibraryService;

  constructor({
    memoryStore,
    config,
    userId,
    bridge,
    stateStore,
    intentRouter,
    videoLibrary,
  }: {
    memoryStore: MemoryStore;
    config: TelegramConfig;
    userId?: string;
    bridge?: TelegramWorkflowBridge;
    stateStore?: TelegramStateStore;
    /** Routes free text to a command. Defaults to the heuristic-only router. */
    intentRouter?: IntentRouter;
    /** Daily AI Video library. Defaults to an in-memory seeded one (no disk). */
    videoLibrary?: VideoLibraryService;
  }) {
    this.memoryStore = memoryStore;
    this.config = config;
    this.userId = userId ?? resolveUserId();
    this.bridge = bridge;
    this.stateStore = stateStore ?? new InMemoryTelegramStateStore();
    this.intentRouter = intentRouter ?? new DefaultIntentRouter();
    this.videoLibrary =
      videoLibrary ?? new VideoLibraryService({ store: new InMemoryVideoStore({ videos: seedVideos() }) });
  }

  /**
   * Handle an inbound text message: a slash command runs directly; free text is
   * routed to a command via the IntentRouter (LLM when configured, else keyword
   * heuristics), falling back to a friendly help reply when nothing matches.
   */
  async handleMessage({
    text,
    chatId,
    progress = NO_PROGRESS,
  }: {
    text: string | undefined;
    chatId: number | string;
    progress?: (text: string) => Promise<void>;
  }): Promise<TelegramReply> {
    const parsed = parseTelegramCommand(text);
    if (parsed !== undefined) {
      return dispatchCommand(
        parsed.command,
        this.buildContext({ argsText: parsed.argsText, chatId, progress }),
      );
    }

    const message = (text ?? '').trim();
    if (message === '') {
      return plainReply('Send /help to see what I can do.');
    }

    const routed = await this.intentRouter.route(message);
    if (routed === undefined) {
      return plainReply(
        `I didn't quite get that. Try one of these:\n\n${formatHelp()}`,
      );
    }
    return dispatchCommand(
      routed.command,
      this.buildContext({ argsText: routed.argsText, chatId, progress }),
    );
  }

  /**
   * Handle an inline-button tap. The button's callback data is a command line, so
   * this parses and dispatches it exactly like a typed command.
   */
  async handleCallback({
    data,
    chatId,
    progress = NO_PROGRESS,
  }: {
    data: string | undefined;
    chatId: number | string;
    progress?: (text: string) => Promise<void>;
  }): Promise<TelegramReply> {
    const parsed = parseTelegramCommand(data);
    if (parsed === undefined) {
      return plainReply('That action is no longer available. Send /help.');
    }
    return dispatchCommand(
      parsed.command,
      this.buildContext({ argsText: parsed.argsText, chatId, progress }),
    );
  }

  /**
   * Handle a reply to a previously-sent artifact: revise it per the user's
   * instruction. The webhook resolves the replied-to message to `ref` via the
   * artifact registry; here the instruction is just the reply text, dispatched
   * through the shared edit handler (which delegates to the workflow bridge).
   */
  async handleArtifactEdit({
    ref,
    instruction,
    chatId,
    progress = NO_PROGRESS,
  }: {
    ref: TelegramArtifactRef;
    instruction: string;
    chatId: number | string;
    progress?: (text: string) => Promise<void>;
  }): Promise<TelegramReply> {
    return editArtifact(this.buildContext({ argsText: instruction, chatId, progress }), ref);
  }

  private buildContext({
    argsText,
    chatId,
    progress,
  }: {
    argsText: string;
    chatId: number | string;
    progress: (text: string) => Promise<void>;
  }): HandlerContext {
    return {
      argsText,
      args: argsText.split(/\s+/).filter((a) => a !== ''),
      chatId,
      userId: this.userId,
      config: this.config,
      memoryStore: this.memoryStore,
      bridge: this.bridge,
      videos: this.videoLibrary,
      state: this.stateStore,
      intentRouter: this.intentRouter,
      progress,
    };
  }
}
