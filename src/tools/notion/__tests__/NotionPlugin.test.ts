import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createNotionPlugin } from '../NotionPlugin.js';

test('exposes paired input and output adapters', () => {
  const plugin = createNotionPlugin();

  assert.equal(typeof plugin.input.execute, 'function');
  assert.equal(typeof plugin.output.execute, 'function');
  assert.equal(plugin.input.name, 'notion-input');
  assert.equal(plugin.output.name, 'notion-output');
});

test('allows injecting custom adapters', () => {
  const input = { name: 'custom-input', execute: async () => ({ requirementText: 'x', source: 'notion' as const }) };
  const plugin = createNotionPlugin({ input });

  assert.equal(plugin.input, input);
  assert.equal(plugin.output.name, 'notion-output');
});
