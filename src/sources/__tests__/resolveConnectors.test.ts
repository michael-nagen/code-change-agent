import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveConnectors } from '../resolveConnectors.js';

test('integrations are disabled by default (no env)', () => {
  const r = resolveConnectors({ env: {} });
  assert.equal(r.enabled, false);
  assert.equal(r.notionConnector, undefined);
  assert.equal(r.githubConnector, undefined);
  assert.deepEqual(r.defaults, {});
});

test('disabled unless SOURCE_INTEGRATIONS_ENABLED is exactly "true"', () => {
  const r = resolveConnectors({ env: { SOURCE_INTEGRATIONS_ENABLED: 'yes', NOTION_API_KEY: 'k' } });
  assert.equal(r.enabled, false);
  assert.equal(r.notionConnector, undefined);
});

test('enabled with Notion key + page constructs a Notion connector and default', () => {
  const r = resolveConnectors({
    env: {
      SOURCE_INTEGRATIONS_ENABLED: 'true',
      NOTION_API_KEY: 'secret',
      NOTION_DEFAULT_PAGE_ID: 'https://notion.so/p-0123456789abcdef0123456789abcdef',
    },
  });
  assert.equal(r.enabled, true);
  assert.ok(r.notionConnector);
  assert.equal(r.defaults.notionPageId, 'https://notion.so/p-0123456789abcdef0123456789abcdef');
});

test('enabled without Notion key warns and skips Notion, but GitHub still works', () => {
  const r = resolveConnectors({
    env: { SOURCE_INTEGRATIONS_ENABLED: 'true', GITHUB_DEFAULT_PR_URL: 'https://github.com/o/r/pull/1' },
  });
  assert.equal(r.enabled, true);
  assert.equal(r.notionConnector, undefined);
  assert.ok(r.githubConnector);
  assert.equal(r.defaults.githubPrUrl, 'https://github.com/o/r/pull/1');
  assert.ok(r.warnings.some((w) => /NOTION_API_KEY/.test(w)));
});
