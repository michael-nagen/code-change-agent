import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseCommand } from '../parseCommand.js';

test('parses a bare command', () => {
  assert.deepEqual(parseCommand('/status'), { command: 'status', args: [] });
});

test('lowercases the command and splits trailing args', () => {
  assert.deepEqual(parseCommand('/Status my-project extra'), {
    command: 'status',
    args: ['my-project', 'extra'],
  });
});

test('strips a @botname suffix (group chats)', () => {
  assert.deepEqual(parseCommand('/help@MyCompanionBot'), { command: 'help', args: [] });
});

test('ignores leading/trailing whitespace', () => {
  assert.deepEqual(parseCommand('   /memory   demo  '), { command: 'memory', args: ['demo'] });
});

test('returns undefined for non-commands', () => {
  assert.equal(parseCommand('hello there'), undefined);
  assert.equal(parseCommand(''), undefined);
  assert.equal(parseCommand(undefined), undefined);
  assert.equal(parseCommand('/'), undefined);
});
