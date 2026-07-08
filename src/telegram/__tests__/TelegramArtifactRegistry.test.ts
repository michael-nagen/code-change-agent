import { test } from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryTelegramArtifactRegistry } from '../TelegramArtifactRegistry.js';
import type { TelegramArtifactRef } from '../types.js';

const REF: TelegramArtifactRef = {
  artifact: 'daily',
  text: 'Daily guidance body.',
  projectLabel: 'demo',
  sessionId: 's-1',
};

test('a reply to any registered chunk resolves the full artifact', () => {
  const registry = new InMemoryTelegramArtifactRegistry();
  registry.register(42, [10, 11, 12], REF);

  assert.deepEqual(registry.lookup(42, 10), REF);
  assert.deepEqual(registry.lookup(42, 12), REF);
});

test('lookup is scoped per chat and returns undefined when unknown', () => {
  const registry = new InMemoryTelegramArtifactRegistry();
  registry.register(42, [10], REF);

  assert.equal(registry.lookup(99, 10), undefined, 'other chats must not resolve');
  assert.equal(registry.lookup(42, 999), undefined, 'unknown message id resolves to nothing');
});

test('non-finite message ids are ignored', () => {
  const registry = new InMemoryTelegramArtifactRegistry();
  registry.register(42, [Number.NaN], REF);
  assert.equal(registry.lookup(42, Number.NaN), undefined);
});

test('the oldest entries are evicted past the cap', () => {
  const registry = new InMemoryTelegramArtifactRegistry({ maxEntries: 2 });
  registry.register(1, [1], REF);
  registry.register(1, [2], REF);
  registry.register(1, [3], REF);

  assert.equal(registry.lookup(1, 1), undefined, 'the oldest id was evicted');
  assert.deepEqual(registry.lookup(1, 2), REF);
  assert.deepEqual(registry.lookup(1, 3), REF);
});
