/**
 * The Telegram REPLY model plus small, pure formatting helpers.
 *
 * A handler returns a `TelegramReply` — one or more outgoing messages, each with
 * optional formatting and keyboard markup. The webhook renderer turns that into
 * concrete `sendMessage`/`editMessageText` calls. Keeping this a plain data model
 * (no I/O) means handlers stay pure and testable, and the adapter stays the only
 * place that talks to Telegram.
 */
import type { OutgoingMessage, TelegramReply, TelegramReplyMarkup } from './types.js';

/** Telegram hard limit is 4096 chars; split below that with a safety margin. */
export const TELEGRAM_SPLIT_LIMIT = 3800;

/** Escape the five characters that matter for Telegram's HTML parse mode. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Bold, HTML-escaped — for section titles in HTML messages. */
export function bold(text: string): string {
  return `<b>${escapeHtml(text)}</b>`;
}

/**
 * Split a long body into Telegram-sized chunks, preferring paragraph then line
 * boundaries so a message is never cut mid-sentence when it can be avoided.
 */
export function splitText(text: string, limit = TELEGRAM_SPLIT_LIMIT): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > limit) {
    const window = remaining.slice(0, limit);
    const at = bestBreak(window);
    const head = remaining.slice(0, at).trimEnd();
    chunks.push(head);
    remaining = remaining.slice(at).replace(/^\n+/, '');
  }
  if (remaining.trim() !== '') chunks.push(remaining);
  return chunks;
}

function bestBreak(window: string): number {
  const paragraph = window.lastIndexOf('\n\n');
  if (paragraph > window.length * 0.5) return paragraph;
  const line = window.lastIndexOf('\n');
  if (line > window.length * 0.5) return line;
  const space = window.lastIndexOf(' ');
  if (space > window.length * 0.5) return space;
  return window.length;
}

/**
 * A plain-text reply, split across messages when long. Any keyboard markup is
 * attached to the LAST message so it renders under the final chunk.
 */
export function plainReply(
  text: string,
  opts: { replyMarkup?: TelegramReplyMarkup } = {},
): TelegramReply {
  return build(splitText(text), undefined, opts.replyMarkup);
}

/**
 * An HTML-formatted reply, split when long. Callers are responsible for escaping
 * dynamic content (see {@link escapeHtml}); static markup like `<b>` is fine.
 */
export function htmlReply(
  text: string,
  opts: { replyMarkup?: TelegramReplyMarkup } = {},
): TelegramReply {
  return build(splitText(text), 'HTML', opts.replyMarkup);
}

function build(
  chunks: string[],
  parseMode: OutgoingMessage['parseMode'],
  replyMarkup: TelegramReplyMarkup | undefined,
): TelegramReply {
  const messages: OutgoingMessage[] = chunks.map((chunk, index) => {
    const message: OutgoingMessage = { text: chunk };
    if (parseMode !== undefined) message.parseMode = parseMode;
    // Markup only on the final chunk so it renders under the last message.
    if (replyMarkup !== undefined && index === chunks.length - 1) {
      message.replyMarkup = replyMarkup;
    }
    return message;
  });
  return { messages: messages.length > 0 ? messages : [{ text: '' }] };
}
