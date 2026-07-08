import { test } from 'node:test';
import assert from 'node:assert/strict';

import { HttpTelegramApi, type TelegramFetch } from '../HttpTelegramApi.js';

const TOKEN = '123456:SECRET-BOT-TOKEN';

test('a failed send never includes the bot token in its error', async () => {
  const fetchImpl: TelegramFetch = async () => ({
    ok: false,
    status: 403,
    text: async () => 'Forbidden',
  });
  const api = new HttpTelegramApi({ botToken: TOKEN, fetchImpl });

  await assert.rejects(
    () => api.sendMessage({ chatId: 1, text: 'hi' }),
    (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      assert.ok(!message.includes(TOKEN), 'token must not appear in the error');
      assert.match(message, /403/);
      return true;
    },
  );
});

test('a successful send targets the Telegram sendMessage endpoint and returns the message id', async () => {
  const calls: { url: string; body: string }[] = [];
  const fetchImpl: TelegramFetch = async (url, init) => {
    calls.push({ url, body: init.body });
    return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, result: { message_id: 99 } }) };
  };
  const api = new HttpTelegramApi({ botToken: TOKEN, fetchImpl });
  const { messageId } = await api.sendMessage({ chatId: 42, text: 'hello' });

  assert.equal(calls.length, 1);
  assert.match(calls[0]?.url ?? '', /\/sendMessage$/);
  const parsed = JSON.parse(calls[0]?.body ?? '{}') as { chat_id: number; text: string };
  assert.equal(parsed.chat_id, 42);
  assert.equal(parsed.text, 'hello');
  assert.equal(messageId, 99);
});

test('an inline keyboard is mapped to Telegram reply_markup wire JSON', async () => {
  let body = '';
  const fetchImpl: TelegramFetch = async (_url, init) => {
    body = init.body;
    return { ok: true, status: 200, text: async () => '{}' };
  };
  const api = new HttpTelegramApi({ botToken: TOKEN, fetchImpl });
  await api.sendMessage({
    chatId: 1,
    text: 'pick',
    parseMode: 'HTML',
    replyMarkup: { kind: 'inline', rows: [[{ text: 'Daily', callbackData: '/daily' }]] },
  });
  const parsed = JSON.parse(body) as {
    parse_mode: string;
    reply_markup: { inline_keyboard: { text: string; callback_data: string }[][] };
  };
  assert.equal(parsed.parse_mode, 'HTML');
  assert.deepEqual(parsed.reply_markup.inline_keyboard, [[{ text: 'Daily', callback_data: '/daily' }]]);
});

test('editMessageText and answerCallbackQuery hit the right endpoints', async () => {
  const urls: string[] = [];
  const fetchImpl: TelegramFetch = async (url) => {
    urls.push(url);
    return { ok: true, status: 200, text: async () => '{}' };
  };
  const api = new HttpTelegramApi({ botToken: TOKEN, fetchImpl });
  await api.editMessageText({ chatId: 1, messageId: 5, text: 'done' });
  await api.answerCallbackQuery({ callbackQueryId: 'cb-1' });
  assert.match(urls[0] ?? '', /\/editMessageText$/);
  assert.match(urls[1] ?? '', /\/answerCallbackQuery$/);
});

test('a failed editMessageText error names the method and status, not the token', async () => {
  const fetchImpl: TelegramFetch = async () => ({ ok: false, status: 400, text: async () => 'bad' });
  const api = new HttpTelegramApi({ botToken: TOKEN, fetchImpl });
  await assert.rejects(
    () => api.editMessageText({ chatId: 1, messageId: 5, text: 'x' }),
    (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      assert.ok(!message.includes(TOKEN));
      assert.match(message, /editMessageText/);
      assert.match(message, /400/);
      return true;
    },
  );
});
