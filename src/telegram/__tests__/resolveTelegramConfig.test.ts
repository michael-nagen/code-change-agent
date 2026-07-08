import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveTelegramConfig, parseChatIds } from '../resolveTelegramConfig.js';

test('disabled when no bot token is set', () => {
  const resolved = resolveTelegramConfig({ env: {} });
  assert.equal(resolved.enabled, false);
  assert.equal(resolved.config, undefined);
});

test('enabled with a bot token and parses allowed chat ids', () => {
  const resolved = resolveTelegramConfig({
    env: {
      TELEGRAM_BOT_TOKEN: '123:abc',
      TELEGRAM_WEBHOOK_SECRET: 's3cret',
      TELEGRAM_ALLOWED_CHAT_IDS: '111, 222 333',
      TELEGRAM_DEFAULT_PROJECT: 'demo',
      TELEGRAM_WEBHOOK_URL: 'https://example.com/api/telegram',
    },
  });
  assert.equal(resolved.enabled, true);
  assert.deepEqual(resolved.config?.allowedChatIds, ['111', '222', '333']);
  assert.equal(resolved.config?.webhookSecret, 's3cret');
  assert.equal(resolved.config?.defaultProject, 'demo');
  assert.equal(resolved.config?.botToken, '123:abc');
});

test('warns when the allow-list is empty (closed bot)', () => {
  const resolved = resolveTelegramConfig({
    env: { TELEGRAM_BOT_TOKEN: '123:abc', TELEGRAM_WEBHOOK_SECRET: 's' },
  });
  assert.equal(resolved.enabled, true);
  assert.deepEqual(resolved.config?.allowedChatIds, []);
  assert.ok(resolved.warnings.some((w) => w.includes('CLOSED')));
});

test('warns when no webhook secret is set', () => {
  const resolved = resolveTelegramConfig({
    env: { TELEGRAM_BOT_TOKEN: '123:abc', TELEGRAM_ALLOWED_CHAT_IDS: '1' },
  });
  assert.ok(resolved.warnings.some((w) => w.includes('TELEGRAM_WEBHOOK_SECRET')));
});

test('parseChatIds handles commas, spaces, and blanks', () => {
  assert.deepEqual(parseChatIds('1, 2,3   4'), ['1', '2', '3', '4']);
  assert.deepEqual(parseChatIds(''), []);
  assert.deepEqual(parseChatIds(undefined), []);
});
