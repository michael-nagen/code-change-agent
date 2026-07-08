import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  clearConfirmKeyboard,
  editResultKeyboard,
  generationKeyboard,
  mainMenuKeyboard,
  projectsKeyboard,
  saveKeyboard,
} from '../keyboards.js';

test('the generation keyboard buttons carry command-line callback data', () => {
  const kb = generationKeyboard();
  const data = kb.rows.flat().map((b) => b.callbackData);
  assert.deepEqual(data, ['/daily', '/technical', '/demo', '/weekly']);
});

test('the save keyboard targets the given source', () => {
  assert.equal(saveKeyboard('weekly').rows[0]?.[0]?.callbackData, '/save weekly');
});

test('the clear-confirm keyboard offers confirm and cancel', () => {
  const data = clearConfirmKeyboard().rows.flat().map((b) => b.callbackData);
  assert.deepEqual(data, ['/clear confirm', '/status']);
});

test('the main menu is a resizable reply keyboard', () => {
  const kb = mainMenuKeyboard();
  assert.equal(kb.kind, 'reply');
  assert.equal(kb.resize, true);
});

test('the edit-result keyboard offers Save + Notion for daily and Edit again + Latest', () => {
  const data = editResultKeyboard('daily').rows.flat().map((b) => b.callbackData);
  assert.deepEqual(data, ['/save daily', '/notion daily', '/edit', '/latest']);
});

test('the edit-result keyboard offers only Notion (no Save) for demo', () => {
  const data = editResultKeyboard('demo').rows.flat().map((b) => b.callbackData);
  assert.deepEqual(data, ['/notion demo', '/edit', '/latest']);
});

test('the edit-result keyboard offers only Edit again + Latest for an analysis summary', () => {
  const data = editResultKeyboard('analyze').rows.flat().map((b) => b.callbackData);
  assert.deepEqual(data, ['/edit', '/latest']);
});

test('projectsKeyboard caps the list and drops ids that overflow callback data', () => {
  const long = 'p'.repeat(80);
  const ids = ['alpha', 'beta', long];
  const kb = projectsKeyboard(ids, 2);
  const labels = kb.rows.flat().map((b) => b.text);
  assert.deepEqual(labels, ['alpha', 'beta']);
  assert.ok(kb.rows.flat().every((b) => Buffer.byteLength(b.callbackData) <= 64));
});
