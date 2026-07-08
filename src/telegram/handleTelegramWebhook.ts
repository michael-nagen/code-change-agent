/**
 * The Telegram webhook boundary.
 *
 * Order of operations:
 *   1. validate the webhook secret (when configured);
 *   2. parse the update — a message OR an inline-button callback query;
 *   3. resolve + authorize the chat (unauthorized chats never see project data);
 *   4. run the command service (commands, natural language, or a button tap);
 *   5. render the reply through the adapter: progress "🔄 …" messages are edited
 *      into the final result, long replies are split, keyboards are attached, and
 *      button taps are acknowledged so the client's spinner stops.
 *
 * It never throws for expected failures; it returns a structured result the HTTP
 * layer maps to a response, and surfaces handler errors as a friendly message.
 * The bot token is not handled here and is never logged.
 */
import type { TelegramCommandService } from './TelegramCommandService.js';
import type {
  TelegramApi,
  TelegramArtifactRegistry,
  TelegramCallbackQuery,
  TelegramConfig,
  TelegramMessage,
  TelegramReply,
  TelegramUpdate,
  TelegramWebhookResult,
} from './types.js';

const UNRESOLVED_REPLY_MESSAGE =
  "I can only edit results I generated. Reply directly to one of my analysis/guidance messages with your change (e.g. \u201Cmake it shorter\u201D), or send a command like /latest.";

export async function handleTelegramWebhook({
  update,
  secretHeader,
  config,
  service,
  api,
  registry,
}: {
  update: unknown;
  /** Value of the `X-Telegram-Bot-Api-Secret-Token` header, if any. */
  secretHeader?: string;
  config: TelegramConfig;
  service: TelegramCommandService;
  api: TelegramApi;
  /** Resolves replied-to messages to artifacts and records rendered ids. */
  registry?: TelegramArtifactRegistry;
}): Promise<TelegramWebhookResult> {
  if (config.webhookSecret !== undefined && secretHeader !== config.webhookSecret) {
    return { statusCode: 401, body: { ok: false, description: 'Invalid webhook secret.' } };
  }

  const parsed = parseUpdate(update);
  if (parsed === undefined) {
    return { statusCode: 200, body: { ok: true, description: 'No actionable update.' } };
  }
  const { chatId } = parsed;

  if (!isChatAllowed({ chatId, allowedChatIds: config.allowedChatIds })) {
    if (parsed.kind === 'callback' && parsed.callbackQueryId !== undefined) {
      await safe(() => api.answerCallbackQuery({ callbackQueryId: parsed.callbackQueryId as string }));
    }
    await safe(() => renderer(api, chatId).send({ messages: [{ text: 'This chat is not authorized to use this bot.' }] }));
    return { statusCode: 200, body: { ok: true, description: 'Chat not authorized.' } };
  }

  // Acknowledge a button tap immediately so its spinner stops, regardless of how
  // long the resulting action takes.
  if (parsed.kind === 'callback' && parsed.callbackQueryId !== undefined) {
    await safe(() => api.answerCallbackQuery({ callbackQueryId: parsed.callbackQueryId as string }));
  }

  const render = renderer(api, chatId);
  let reply: TelegramReply;
  try {
    reply = await resolveReply({
      parsed,
      chatId,
      service,
      progress: render.progress,
      ...(registry !== undefined ? { registry } : {}),
    });
  } catch (err) {
    reply = { messages: [{ text: `Sorry, that failed: ${err instanceof Error ? err.message : String(err)}` }] };
  }

  const messageIds = await safeIds(() => render.send(reply));
  // Record the artifact against every id it rendered, so a reply to any chunk
  // (or the edited progress message) resolves the full artifact for editing.
  if (reply.artifact !== undefined && registry !== undefined && messageIds.length > 0) {
    registry.register(chatId, messageIds, reply.artifact);
  }
  return { statusCode: 200, body: { ok: true } };
}

/**
 * Turn a parsed update into a reply. A plain-text message that is a REPLY to a
 * known artifact becomes an edit; a reply to something unknown gets a friendly
 * error (never silently ignored). Slash commands, button taps, and non-reply
 * messages take the normal dispatch path.
 */
async function resolveReply({
  parsed,
  chatId,
  service,
  registry,
  progress,
}: {
  parsed: ParsedUpdate;
  chatId: number | string;
  service: TelegramCommandService;
  registry?: TelegramArtifactRegistry;
  progress: (text: string) => Promise<void>;
}): Promise<TelegramReply> {
  if (parsed.kind === 'callback') {
    return service.handleCallback({ data: parsed.data, chatId, progress });
  }

  const isReply = parsed.replyToMessageId !== undefined;
  const looksLikeCommand = (parsed.text ?? '').trim().startsWith('/');
  if (isReply && !looksLikeCommand) {
    const ref =
      registry !== undefined && parsed.replyToMessageId !== undefined
        ? registry.lookup(chatId, parsed.replyToMessageId)
        : undefined;
    if (ref === undefined) {
      return { messages: [{ text: UNRESOLVED_REPLY_MESSAGE }] };
    }
    return service.handleArtifactEdit({ ref, instruction: parsed.text ?? '', chatId, progress });
  }

  return service.handleMessage({ text: parsed.text, chatId, progress });
}

/** True when the chat id is on the allow-list. An empty list denies everyone. */
export function isChatAllowed({
  chatId,
  allowedChatIds,
}: {
  chatId: number | string;
  allowedChatIds: string[];
}): boolean {
  if (allowedChatIds.length === 0) return false;
  return allowedChatIds.includes(String(chatId));
}

type ParsedUpdate =
  | { kind: 'message'; chatId: number | string; text: string | undefined; replyToMessageId?: number }
  | { kind: 'callback'; chatId: number | string; data: string | undefined; callbackQueryId?: string };

function parseUpdate(update: unknown): ParsedUpdate | undefined {
  if (typeof update !== 'object' || update === null) return undefined;
  const u = update as TelegramUpdate;

  const callback: TelegramCallbackQuery | undefined = u.callback_query;
  if (callback !== undefined) {
    const chatId = callback.message?.chat?.id;
    if (chatId === undefined) return undefined;
    return {
      kind: 'callback',
      chatId,
      data: callback.data,
      ...(callback.id !== undefined ? { callbackQueryId: callback.id } : {}),
    };
  }

  const message: TelegramMessage | undefined = u.message ?? u.edited_message;
  const chatId = message?.chat?.id;
  if (message === undefined || chatId === undefined) return undefined;
  const replyToId = message.reply_to_message?.message_id;
  return {
    kind: 'message',
    chatId,
    text: message.text,
    ...(typeof replyToId === 'number' ? { replyToMessageId: replyToId } : {}),
  };
}

/**
 * A per-interaction renderer that turns a {@link TelegramReply} into concrete
 * adapter calls. `progress` shows a status line the first time and edits it
 * thereafter; `send` then edits that same message into the final first chunk (so
 * "🔄 …" becomes the result) and sends any remaining chunks as new messages.
 */
function renderer(api: TelegramApi, chatId: number | string) {
  let progressMessageId: number | undefined;

  const progress = async (text: string): Promise<void> => {
    if (progressMessageId === undefined) {
      const { messageId } = await api.sendMessage({ chatId, text });
      progressMessageId = messageId;
    } else {
      await api.editMessageText({ chatId, messageId: progressMessageId, text });
    }
  };

  const send = async (reply: TelegramReply): Promise<number[]> => {
    const messages = reply.messages;
    const ids: number[] = [];
    let index = 0;

    const first = messages[0];
    if (progressMessageId !== undefined && first !== undefined && isEditable(first.replyMarkup?.kind)) {
      await api.editMessageText({
        chatId,
        messageId: progressMessageId,
        text: first.text,
        ...(first.parseMode !== undefined ? { parseMode: first.parseMode } : {}),
        ...(first.replyMarkup?.kind === 'inline' ? { replyMarkup: first.replyMarkup } : {}),
      });
      ids.push(progressMessageId);
      index = 1;
    }

    for (const message of messages.slice(index)) {
      const { messageId } = await api.sendMessage({
        chatId,
        text: message.text,
        ...(message.parseMode !== undefined ? { parseMode: message.parseMode } : {}),
        ...(message.replyMarkup !== undefined ? { replyMarkup: message.replyMarkup } : {}),
      });
      if (messageId !== undefined) ids.push(messageId);
    }
    return ids;
  };

  return { progress, send };
}

/** Edited messages accept only inline keyboards, so reply keyboards must be sent. */
function isEditable(kind: string | undefined): boolean {
  return kind === undefined || kind === 'inline';
}

async function safe(action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
  } catch {
    // A send/edit failure must not turn into a 500 that makes Telegram retry.
  }
}

/** Like {@link safe} but returns the rendered message ids ([] on failure). */
async function safeIds(action: () => Promise<number[]>): Promise<number[]> {
  try {
    return await action();
  } catch {
    return [];
  }
}
