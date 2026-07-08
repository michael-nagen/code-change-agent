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

test('a successful send targets the Telegram sendMessage endpoint with the chat + text', async () => {
  const calls: { url: string; body: string }[] = [];
  const fetchImpl: TelegramFetch = async (url, init) => {
    calls.push({ url, body: init.body });
    return { ok: true, status: 200, text: async () => 'ok' };
  };
  const api = new HttpTelegramApi({ botToken: TOKEN, fetchImpl });
  await api.sendMessage({ chatId: 42, text: 'hello' });

  assert.equal(calls.length, 1);
  assert.match(calls[0]?.url ?? '', /\/sendMessage$/);
  const parsed = JSON.parse(calls[0]?.body ?? '{}') as { chat_id: number; text: string };
  assert.equal(parsed.chat_id, 42);
  assert.equal(parsed.text, 'hello');
});
