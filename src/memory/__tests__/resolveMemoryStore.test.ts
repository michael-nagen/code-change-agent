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
import { DbMemoryStore } from '../DbMemoryStore.js';
import { MemoryStoreError } from '../../errors/MemoryStoreError.js';

test('defaults to the durable file store', () => {
  const store = resolveMemoryStore({});
  assert.ok(store instanceof JsonFileMemoryStore);
});

test('MEMORY_STORE=db selects the DB store when DATABASE_URL is set', () => {
  const store = resolveMemoryStore({
    MEMORY_STORE: 'db',
    DATABASE_URL: 'postgres://user:pass@localhost:5432/app',
  });
  assert.ok(store instanceof DbMemoryStore);
});

test('MEMORY_STORE=db without DATABASE_URL throws a clear CONFIG error', () => {
  assert.throws(
    () => resolveMemoryStore({ MEMORY_STORE: 'db' }),
    (err: unknown) => err instanceof MemoryStoreError && err.code === 'CONFIG',
  );
});

test('DATABASE_URL is ignored unless MEMORY_STORE=db', () => {
  const store = resolveMemoryStore({ DATABASE_URL: 'postgres://ignored/db' });
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
