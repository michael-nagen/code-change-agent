import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveMemoryStore,
  resolveUserId,
  toMemoryProjectId,
  DEFAULT_USER_ID,
} from '../resolveMemoryStore.js';
import { InMemoryMemoryStore } from '../InMemoryMemoryStore.js';
import { JsonFileMemoryStore } from '../JsonFileMemoryStore.js';

test('defaults to the durable file store', () => {
  const store = resolveMemoryStore({});
  assert.ok(store instanceof JsonFileMemoryStore);
});

test('MEMORY_STORE=memory selects the in-memory store', () => {
  const store = resolveMemoryStore({ MEMORY_STORE: 'memory' });
  assert.ok(store instanceof InMemoryMemoryStore);
});

test('MEMORY_STORE=file selects the file store', () => {
  const store = resolveMemoryStore({ MEMORY_STORE: 'file', MEMORY_DATA_DIR: '/tmp/whatever' });
  assert.ok(store instanceof JsonFileMemoryStore);
});

test('resolveUserId falls back to the safe default', () => {
  assert.equal(resolveUserId({}), DEFAULT_USER_ID);
  assert.equal(resolveUserId({ MEMORY_USER_ID: '  ' }), DEFAULT_USER_ID);
  assert.equal(resolveUserId({ MEMORY_USER_ID: 'Alice' }), 'alice');
});

test('toMemoryProjectId slugifies to a filesystem-safe id', () => {
  assert.equal(toMemoryProjectId('Checkout Service!'), 'checkout-service');
  assert.equal(toMemoryProjectId('  My Project  '), 'my-project');
  assert.equal(toMemoryProjectId('***'), undefined);
  assert.equal(toMemoryProjectId(''), undefined);
});
