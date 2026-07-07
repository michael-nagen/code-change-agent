import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DefaultNotionInputAdapter } from '../NotionInputAdapter.js';
import { ToolError } from '../../../errors/ToolError.js';

test('passes rawText through verbatim as requirementText', async () => {
  const adapter = new DefaultNotionInputAdapter();

  const result = await adapter.execute({ rawText: '  Build a planning stage  ' });

  assert.equal(result.requirementText, '  Build a planning stage  ');
  assert.equal(result.source, 'notion');
});

test('preserves provided metadata', async () => {
  const adapter = new DefaultNotionInputAdapter();

  const result = await adapter.execute({
    rawText: 'Build a planning stage',
    notionPageId: 'page-123',
    notionUrl: 'https://notion.so/page-123',
    title: 'Planning Spec',
  });

  assert.deepEqual(result.metadata, {
    pageId: 'page-123',
    url: 'https://notion.so/page-123',
    title: 'Planning Spec',
  });
});

test('omits metadata entirely when none is provided', async () => {
  const adapter = new DefaultNotionInputAdapter();

  const result = await adapter.execute({ rawText: 'Build a planning stage' });

  assert.equal(result.metadata, undefined);
});

test('fails clearly when neither rawText nor page content is available', async () => {
  const adapter = new DefaultNotionInputAdapter();

  await assert.rejects(
    () => adapter.execute({ notionPageId: 'page-123' }),
    (err: unknown) => err instanceof ToolError && err.code === 'VALIDATION',
  );
});

test('fails clearly when rawText is only whitespace', async () => {
  const adapter = new DefaultNotionInputAdapter();

  await assert.rejects(
    () => adapter.execute({ rawText: '   ' }),
    (err: unknown) => err instanceof ToolError && err.code === 'VALIDATION',
  );
});
