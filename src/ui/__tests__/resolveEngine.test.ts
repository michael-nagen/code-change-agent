import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveHarnessSourceDeps, resolveNotionWriteBack } from '../resolveEngine.js';

// resolveHarnessSourceDeps is the single seam both the local server and the
// serverless entry use to wire connectors into the harness. Testing it with an
// explicit env keeps the check credential-free (no OpenAI, no live Notion/GitHub)
// while locking the production wiring that previously existed only locally.

test('source integrations are disabled by default (no connectors, empty defaults)', () => {
  const deps = resolveHarnessSourceDeps({});
  assert.equal(deps.notionConnector, undefined);
  assert.equal(deps.githubConnector, undefined);
  assert.deepEqual(deps.sourceDefaults, {});
});

test('when enabled, configured Notion/GitHub connectors and defaults are wired', () => {
  const deps = resolveHarnessSourceDeps({
    SOURCE_INTEGRATIONS_ENABLED: 'true',
    NOTION_API_KEY: 'secret-notion-key',
    NOTION_DEFAULT_PAGE_ID: 'page-123',
    GITHUB_DEFAULT_PR_URL: 'https://github.com/o/r/pull/1',
  });

  assert.ok(deps.notionConnector, 'expected a Notion connector');
  assert.ok(deps.githubConnector, 'expected a GitHub connector');
  assert.equal(deps.sourceDefaults.notionPageId, 'page-123');
  assert.equal(deps.sourceDefaults.githubPrUrl, 'https://github.com/o/r/pull/1');
});

test('enabled without a Notion key fails open: GitHub still wired, Notion skipped', () => {
  const deps = resolveHarnessSourceDeps({
    SOURCE_INTEGRATIONS_ENABLED: 'true',
    GITHUB_DEFAULT_PR_URL: 'https://github.com/o/r/pull/2',
  });

  assert.equal(deps.notionConnector, undefined);
  assert.ok(deps.githubConnector, 'GitHub public PRs need no token, so it stays wired');
  assert.equal(deps.sourceDefaults.githubPrUrl, 'https://github.com/o/r/pull/2');
  assert.equal(deps.sourceDefaults.notionPageId, undefined);
});

// The same env-driven seam builds the Notion write-back service for both local
// and serverless, so production write-back cannot silently drift from local.

test('Notion write-back is unconfigured when integrations are off', () => {
  const service = resolveNotionWriteBack({});
  assert.equal(service.isConfigured(), false);
});

test('Notion write-back is configured from env when a key + page are set', () => {
  const service = resolveNotionWriteBack({
    SOURCE_INTEGRATIONS_ENABLED: 'true',
    NOTION_API_KEY: 'secret-notion-key',
    NOTION_DEFAULT_PAGE_ID: 'page-123',
  });
  assert.equal(service.isConfigured(), true);
});

test('Notion write-back stays unconfigured without a Notion key (no write path)', () => {
  const service = resolveNotionWriteBack({
    SOURCE_INTEGRATIONS_ENABLED: 'true',
    GITHUB_DEFAULT_PR_URL: 'https://github.com/o/r/pull/1',
  });
  assert.equal(service.isConfigured(), false);
});
