import { test } from 'node:test';
import assert from 'node:assert/strict';

import { escapeHtml, plainReply, splitText, TELEGRAM_SPLIT_LIMIT } from '../reply.js';
import { mainMenuKeyboard } from '../keyboards.js';

test('splitText keeps a short message as a single chunk', () => {
  assert.deepEqual(splitText('hello'), ['hello']);
});

test('splitText breaks a long message into Telegram-sized chunks on boundaries', () => {
  const paragraph = 'x'.repeat(1000);
  const long = Array.from({ length: 6 }, () => paragraph).join('\n\n');
  const chunks = splitText(long);
  assert.ok(chunks.length > 1, 'should split into multiple chunks');
  for (const chunk of chunks) {
    assert.ok(chunk.length <= TELEGRAM_SPLIT_LIMIT, 'each chunk within the limit');
  }
  assert.equal(chunks.join('').replace(/\s/g, ''), long.replace(/\s/g, ''));
});

test('plainReply attaches keyboard markup only to the last message', () => {
  const long = 'y'.repeat(TELEGRAM_SPLIT_LIMIT + 500);
  const reply = plainReply(long, { replyMarkup: mainMenuKeyboard() });
  assert.ok(reply.messages.length >= 2);
  assert.equal(reply.messages[0]?.replyMarkup, undefined);
  assert.equal(reply.messages.at(-1)?.replyMarkup?.kind, 'reply');
});

test('escapeHtml escapes the three HTML-significant characters', () => {
  assert.equal(escapeHtml('a < b & c > d'), 'a &lt; b &amp; c &gt; d');
});
