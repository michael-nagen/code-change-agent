/**
 * Telegram integration types.
 *
 * Telegram is a THIN interface over the existing product logic — it reads the
 * same `MemoryStore` the UI uses and drives the SAME analysis workflow through a
 * bridge, never duplicating reasoning or LLM logic. These types
 * cover only the small slice of the Telegram Bot API we depend on, plus the
 * resolved config and the injected send seam (kept injectable so tests never hit
 * the real Telegram API and the bot token is never required in tests).
 */

/** Resolved Telegram configuration, built from environment variables. */
export interface TelegramConfig {
  /** Bot token from BotFather. Never logged. */
  botToken: string;
  /** Optional secret Telegram echoes back in the webhook header, when set. */
  webhookSecret?: string;
  /**
   * Chat ids allowed to use the bot. When EMPTY the bot is CLOSED (deny-all) —
   * a safe default so memory is never exposed to an unconfigured deployment.
   */
  allowedChatIds: string[];
  /** Default project id used by commands when a chat gives none. */
  defaultProject?: string;
  /** The public webhook URL (used only by the setup docs / setWebhook helper). */
  webhookUrl?: string;
}

/** The result of resolving config from env: config only when a token is present. */
export interface ResolvedTelegramConfig {
  enabled: boolean;
  config?: TelegramConfig;
  /** Non-fatal configuration notes (e.g. "no allowed chat ids — bot is closed"). */
  warnings: string[];
}

/** The minimal Telegram update shape we parse (message text + chat id). */
export interface TelegramUpdate {
  update_id?: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}

export interface TelegramMessage {
  message_id?: number;
  text?: string;
  chat?: { id?: number | string; type?: string };
  from?: { id?: number | string; username?: string };
}

/** A parsed bot command: the bare command name plus any trailing arguments. */
export interface ParsedCommand {
  /** Lowercased command without the leading slash, e.g. "status". */
  command: string;
  /** Whitespace-separated arguments after the command. */
  args: string[];
}

/**
 * A richer parse of a command line: the bare command plus BOTH the raw remainder
 * (`argsText`, preserving spaces so a project name or pasted spec/diff survives)
 * and the whitespace tokens (`args`, handy for flags like `confirm`).
 */
export interface ParsedTelegramCommand {
  /** Lowercased command without the leading slash, e.g. "analyze". */
  command: string;
  /** Everything after the command, trimmed, with internal spacing preserved. */
  argsText: string;
  /** Whitespace-separated tokens of `argsText`. */
  args: string[];
}

/** The artifact a generation command produces. */
export type TelegramArtifactKind = 'analyze' | 'daily' | 'technical' | 'demo' | 'weekly';

/** Which generated artifact's proposed memory update a `/save` would persist. */
export type TelegramSaveSource = 'daily' | 'weekly';

/**
 * Lightweight per-chat CONTROL state — not durable product memory. It only
 * remembers enough to make multi-step flows work (generate → save, clear
 * confirmation, session reuse for on-demand generation). Project Memory remains
 * the durable source of truth and is stored via the MemoryStore, never here.
 */
export interface TelegramChatState {
  /** The active project label for this chat, set via `/project`. */
  activeProject?: string;
  /** The last analysis session id, so follow-up generation can reuse artifacts. */
  lastSessionId?: string;
  /** The resolved inputs of the last run, resent to reuse a session safely. */
  lastInputs?: { requirementText: string; rawDiff: string };
  /** The last artifact generated in this chat. */
  lastArtifact?: TelegramArtifactKind;
  /** A pending, saveable memory update source (from `/daily` or `/weekly`). */
  pendingSaveSource?: TelegramSaveSource;
  /** Whether a `/clear` is awaiting `/clear confirm`. */
  pendingClear?: boolean;
}

/** Storage seam for per-chat control state. Simple by design (see notes above). */
export interface TelegramStateStore {
  /** Read a chat's state (never undefined — returns an empty state if unseen). */
  get(chatId: number | string): TelegramChatState;
  /** Shallow-merge a patch into a chat's state and return the merged state. */
  update(chatId: number | string, patch: Partial<TelegramChatState>): TelegramChatState;
}

/** The seam used to send a message back to Telegram. Injected for testability. */
export interface TelegramApi {
  sendMessage(input: { chatId: number | string; text: string }): Promise<void>;
}

/** What the webhook boundary returns to the HTTP layer. */
export interface TelegramWebhookResult {
  statusCode: number;
  body: { ok: boolean; description?: string };
}
