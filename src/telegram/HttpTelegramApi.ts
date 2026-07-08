/**
 * A minimal Telegram Bot API client — the ADAPTER that only receives/sends.
 *
 * It owns exactly the network plumbing (send a message, edit a message, answer a
 * callback query) and the translation between our storage-agnostic markup model
 * and Telegram's wire JSON. It contains no product logic and no reasoning.
 *
 * Network access is injected (`fetchImpl`) so tests never hit the real Telegram
 * API. The bot token is held privately and is NEVER logged — not on success and
 * not in error messages (the token is part of the URL path, so failures report
 * the method + status code only, never the URL).
 */
import type {
  AnswerCallbackQueryInput,
  EditMessageTextInput,
  InlineKeyboardMarkup,
  SendMessageInput,
  TelegramApi,
  TelegramReplyMarkup,
} from './types.js';

export interface TelegramFetchResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export type TelegramFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<TelegramFetchResponse>;

const defaultFetch: TelegramFetch = (url, init) =>
  fetch(url, init as RequestInit) as unknown as Promise<TelegramFetchResponse>;

export class HttpTelegramApi implements TelegramApi {
  private readonly botToken: string;
  private readonly fetchImpl: TelegramFetch;

  constructor({ botToken, fetchImpl }: { botToken: string; fetchImpl?: TelegramFetch }) {
    this.botToken = botToken;
    this.fetchImpl = fetchImpl ?? defaultFetch;
  }

  async sendMessage({
    chatId,
    text,
    parseMode,
    replyMarkup,
  }: SendMessageInput): Promise<{ messageId?: number }> {
    const payload: Record<string, unknown> = { chat_id: chatId, text };
    if (parseMode !== undefined) payload.parse_mode = parseMode;
    const markup = toWireMarkup(replyMarkup);
    if (markup !== undefined) payload.reply_markup = markup;

    const body = await this.call('sendMessage', payload);
    const messageId = readMessageId(body);
    return messageId !== undefined ? { messageId } : {};
  }

  async editMessageText({
    chatId,
    messageId,
    text,
    parseMode,
    replyMarkup,
  }: EditMessageTextInput): Promise<void> {
    const payload: Record<string, unknown> = { chat_id: chatId, message_id: messageId, text };
    if (parseMode !== undefined) payload.parse_mode = parseMode;
    const markup = toWireMarkup(replyMarkup);
    if (markup !== undefined) payload.reply_markup = markup;
    await this.call('editMessageText', payload);
  }

  async answerCallbackQuery({ callbackQueryId, text }: AnswerCallbackQueryInput): Promise<void> {
    const payload: Record<string, unknown> = { callback_query_id: callbackQueryId };
    if (text !== undefined) payload.text = text;
    await this.call('answerCallbackQuery', payload);
  }

  /** Issue one Bot API method call and return the parsed JSON (best-effort). */
  private async call(method: string, payload: Record<string, unknown>): Promise<unknown> {
    const url = `https://api.telegram.org/bot${this.botToken}/${method}`;
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      // Never include the URL/token in the error — only the method + status.
      throw new Error(`Telegram ${method} failed with status ${response.status}.`);
    }
    try {
      return JSON.parse(await response.text());
    } catch {
      return undefined;
    }
  }
}

/** Map our markup model to Telegram's `reply_markup` JSON, or undefined. */
function toWireMarkup(markup: TelegramReplyMarkup | undefined): unknown {
  if (markup === undefined) return undefined;
  if (markup.kind === 'inline') return toInlineWire(markup);
  if (markup.kind === 'reply') {
    return {
      keyboard: markup.rows.map((row) => row.map((label) => ({ text: label }))),
      resize_keyboard: markup.resize ?? true,
      one_time_keyboard: markup.oneTime ?? false,
    };
  }
  // removeReply
  return { remove_keyboard: true };
}

function toInlineWire(markup: InlineKeyboardMarkup): unknown {
  return {
    inline_keyboard: markup.rows.map((row) =>
      row.map((button) => ({ text: button.text, callback_data: button.callbackData })),
    ),
  };
}

function readMessageId(body: unknown): number | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const result = (body as { result?: unknown }).result;
  if (typeof result !== 'object' || result === null) return undefined;
  const id = (result as { message_id?: unknown }).message_id;
  return typeof id === 'number' ? id : undefined;
}
