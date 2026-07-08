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
  /** A tapped inline-keyboard button (native Telegram UX). */
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramMessage {
  message_id?: number;
  text?: string;
  chat?: { id?: number | string; type?: string };
  from?: { id?: number | string; username?: string };
  /** Present when this message is a reply — enables the reply-to-edit flow. */
  reply_to_message?: TelegramMessage;
}

/** An inline-keyboard button press. `data` is our own command-line payload. */
export interface TelegramCallbackQuery {
  id?: string;
  data?: string;
  message?: TelegramMessage;
  from?: { id?: number | string; username?: string };
}

/** Telegram message formatting mode. We use HTML for robust, escape-safe output. */
export type TelegramParseMode = 'HTML' | 'Markdown' | 'MarkdownV2';

/** One inline-keyboard button: a label plus the callback payload it sends back. */
export interface InlineKeyboardButton {
  text: string;
  callbackData: string;
}

/** An inline keyboard: rows of buttons rendered under a message. */
export interface InlineKeyboardMarkup {
  kind: 'inline';
  rows: InlineKeyboardButton[][];
}

/** A reply keyboard: rows of quick-reply buttons shown in place of the keypad. */
export interface ReplyKeyboardMarkup {
  kind: 'reply';
  rows: string[][];
  resize?: boolean;
  oneTime?: boolean;
}

/** Remove a previously shown reply keyboard. */
export interface RemoveReplyKeyboard {
  kind: 'removeReply';
}

/** Any markup a message may carry. Inline vs reply is chosen by the handler. */
export type TelegramReplyMarkup = InlineKeyboardMarkup | ReplyKeyboardMarkup | RemoveReplyKeyboard;

/** One outgoing message: text plus optional formatting and keyboard markup. */
export interface OutgoingMessage {
  text: string;
  parseMode?: TelegramParseMode;
  replyMarkup?: TelegramReplyMarkup;
}

/**
 * What a command/handler produces: one or more outgoing messages. The webhook
 * renderer sends them (splitting/editing as needed); handlers never do I/O.
 *
 * When `artifact` is set, the reply represents a generated artifact: the webhook
 * records every message id it renders against this artifact so a later REPLY to
 * any of them (even a split chunk) resolves the full artifact for editing.
 */
export interface TelegramReply {
  messages: OutgoingMessage[];
  artifact?: TelegramArtifactRef;
}

/**
 * Enough metadata about a sent artifact to resolve a future reply-to-edit: the
 * artifact kind, project label, the FULL rendered text (the source of truth for
 * an edit), and the analysis session it came from (so `/save`/`/notion` still
 * work after an edit). Stored per Telegram message id in the registry.
 */
export interface TelegramArtifactRef {
  artifact: TelegramArtifactKind;
  /** The complete rendered text — a reply edits this, not a single chunk. */
  text: string;
  projectLabel?: string;
  /** The analysis session that produced it, when known. */
  sessionId?: string;
}

/**
 * Maps sent Telegram message ids to the artifact they belong to, so a reply to
 * any part of a (possibly split) artifact resolves the whole thing. This is
 * ephemeral per-deployment CONTROL state, never durable product memory.
 */
export interface TelegramArtifactRegistry {
  /** Associate every id of a rendered artifact with its ref. */
  register(chatId: number | string, messageIds: number[], ref: TelegramArtifactRef): void;
  /** Resolve the artifact a replied-to message belongs to, if any. */
  lookup(chatId: number | string, messageId: number): TelegramArtifactRef | undefined;
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
  /** The rendered text of the last generated artifact, so `/latest` is free. */
  lastArtifactText?: string;
  /** The project label the last artifact was generated for. */
  lastArtifactProject?: string;
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

/** Input to send a message: text plus optional formatting and keyboard markup. */
export interface SendMessageInput {
  chatId: number | string;
  text: string;
  parseMode?: TelegramParseMode;
  replyMarkup?: TelegramReplyMarkup;
}

/** Input to edit an existing message in place (used for progress → result). */
export interface EditMessageTextInput {
  chatId: number | string;
  messageId: number;
  text: string;
  parseMode?: TelegramParseMode;
  /** Only inline keyboards can be attached to an edited message. */
  replyMarkup?: InlineKeyboardMarkup;
}

/** Input to acknowledge an inline-button tap (stops the client's spinner). */
export interface AnswerCallbackQueryInput {
  callbackQueryId: string;
  text?: string;
}

/**
 * The seam used to talk to Telegram. Injected for testability so tests never hit
 * the network and the bot token is never required. `sendMessage` returns the new
 * message id (when Telegram provides it) so the caller can later edit it.
 */
export interface TelegramApi {
  sendMessage(input: SendMessageInput): Promise<{ messageId?: number }>;
  editMessageText(input: EditMessageTextInput): Promise<void>;
  answerCallbackQuery(input: AnswerCallbackQueryInput): Promise<void>;
}

/** What the webhook boundary returns to the HTTP layer. */
export interface TelegramWebhookResult {
  statusCode: number;
  body: { ok: boolean; description?: string };
}
