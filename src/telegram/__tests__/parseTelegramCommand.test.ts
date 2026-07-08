import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseTelegramCommand,
  parseInlineSpecDiff,
  parseConfirmFlag,
  parseSaveSource,
} from '../parseTelegramCommand.js';

test('parseTelegramCommand splits command from the raw remainder (spacing preserved)', () => {
  const parsed = parseTelegramCommand('/analyze Developer Work Companion');
  assert.deepEqual(parsed, {
    command: 'analyze',
    argsText: 'Developer Work Companion',
    args: ['Developer', 'Work', 'Companion'],
  });
});

test('parseTelegramCommand strips a @bot suffix and returns an empty remainder for bare commands', () => {
  const parsed = parseTelegramCommand('/status@MyBot');
  assert.equal(parsed?.command, 'status');
  assert.equal(parsed?.argsText, '');
});

test('parseTelegramCommand returns undefined for non-commands', () => {
  assert.equal(parseTelegramCommand('hello there'), undefined);
  assert.equal(parseTelegramCommand(undefined), undefined);
});

test('parseInlineSpecDiff treats a bare remainder as a project name', () => {
  assert.deepEqual(parseInlineSpecDiff('My Project'), { projectName: 'My Project' });
  assert.deepEqual(parseInlineSpecDiff('   '), {});
});

test('parseInlineSpecDiff extracts spec and diff sections (order-independent)', () => {
  const parsed = parseInlineSpecDiff('spec: build the feature diff: +added line');
  assert.equal(parsed.spec, 'build the feature');
  assert.equal(parsed.diff, '+added line');
  assert.equal(parsed.projectName, undefined);

  const reversed = parseInlineSpecDiff('diff: +added line spec: build the feature');
  assert.equal(reversed.spec, 'build the feature');
  assert.equal(reversed.diff, '+added line');
});

test('parseInlineSpecDiff keeps a leading project name before markers', () => {
  const parsed = parseInlineSpecDiff('My Project spec: do X diff: +y');
  assert.equal(parsed.projectName, 'My Project');
  assert.equal(parsed.spec, 'do X');
  assert.equal(parsed.diff, '+y');
});

test('parseConfirmFlag detects a standalone confirm token', () => {
  assert.equal(parseConfirmFlag(['confirm']), true);
  assert.equal(parseConfirmFlag(['Confirm']), true);
  assert.equal(parseConfirmFlag([]), false);
  assert.equal(parseConfirmFlag(['confirmation']), false);
});

test('parseSaveSource reads daily/weekly and ignores anything else', () => {
  assert.equal(parseSaveSource(['daily']), 'daily');
  assert.equal(parseSaveSource(['weekly']), 'weekly');
  assert.equal(parseSaveSource(['something']), undefined);
  assert.equal(parseSaveSource([]), undefined);
});
