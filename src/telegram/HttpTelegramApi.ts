/**
 * A minimal Telegram Bot API client for sending messages.
 *
 * Network access is injected (`fetchImpl`) so tests never hit the real Telegram
 * API. The bot token is held privately and is NEVER logged — not on success and
 * not in error messages (the token is part of the URL path, so failures report
 * the status code only, never the URL).
 */
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

export class HttpTelegramApi {
  private readonly botToken: string;
  private readonly fetchImpl: TelegramFetch;

  constructor({ botToken, fetchImpl }: { botToken: string; fetchImpl?: TelegramFetch }) {
    this.botToken = botToken;
    this.fetchImpl = fetchImpl ?? defaultFetch;
  }

  async sendMessage({ chatId, text }: { chatId: number | string; text: string }): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!response.ok) {
      // Never include the URL/token in the error.
      throw new Error(`Telegram sendMessage failed with status ${response.status}.`);
    }
  }
}
