import { test } from 'node:test';
import assert from 'node:assert/strict';

import { HttpNotionConnector, extractNotionPageId } from '../connectors/HttpNotionConnector.js';
import { SourceError } from '../../errors/SourceError.js';
import type { SourceFetch, SourceResponse } from '../types.js';

const PAGE_ID = '0123456789abcdef0123456789abcdef';

const BLOCKS_RESPONSE = {
  results: [
    { type: 'heading_1', heading_1: { rich_text: [{ plain_text: 'Spec' }] } },
    { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Build a cache.' }] } },
    { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ plain_text: 'TTL' }] } },
    { type: 'to_do', to_do: { rich_text: [{ plain_text: 'Add eviction' }], checked: false } },
  ],
};

function mockFetch(handler: (url: string, init?: unknown) => Partial<SourceResponse> & { jsonBody?: unknown }): {
  fetchImpl: SourceFetch;
  calls: { url: string; init?: unknown }[];
} {
  const calls: { url: string; init?: unknown }[] = [];
  const fetchImpl: SourceFetch = async (url, init) => {
    calls.push({ url, init });
    const resp = handler(url, init);
    return {
      ok: resp.ok ?? true,
      status: resp.status ?? 200,
      text: async () => '',
      json: async () => resp.jsonBody ?? {},
    };
  };
  return { fetchImpl, calls };
}

test('extractNotionPageId handles URLs, dashed ids, and rejects junk', () => {
  assert.equal(
    extractNotionPageId('https://www.notion.so/My-Page-0123456789abcdef0123456789abcdef'),
    PAGE_ID,
  );
  assert.equal(extractNotionPageId('01234567-89ab-cdef-0123-456789abcdef'), PAGE_ID);
  assert.throws(() => extractNotionPageId('no-id-here'), SourceError);
});

test('constructing without an API key fails with a CONFIG error', () => {
  assert.throws(
    () => new HttpNotionConnector({ apiKey: '  ' }),
    (err: unknown) => err instanceof SourceError && err.code === 'CONFIG',
  );
});

test('readPage flattens blocks into text and authenticates', async () => {
  const { fetchImpl, calls } = mockFetch(() => ({ jsonBody: BLOCKS_RESPONSE }));
  const connector = new HttpNotionConnector({ apiKey: 'secret', fetchImpl });

  const source = await connector.readPage({ pageIdOrUrl: PAGE_ID });

  assert.equal(source.source.kind, 'notion');
  assert.match(source.text, /# Spec/);
  assert.match(source.text, /Build a cache\./);
  assert.match(source.text, /- TTL/);
  assert.match(source.text, /- \[ \] Add eviction/);
  const headers = (calls[0]?.init as { headers?: Record<string, string> } | undefined)?.headers;
  assert.equal(headers?.Authorization, 'Bearer secret');
  assert.ok(headers?.['Notion-Version']);
});

test('a 404 surfaces a clear NOT_FOUND error', async () => {
  const { fetchImpl } = mockFetch(() => ({ ok: false, status: 404 }));
  const connector = new HttpNotionConnector({ apiKey: 'secret', fetchImpl });
  await assert.rejects(
    () => connector.readPage({ pageIdOrUrl: PAGE_ID }),
    (err: unknown) => err instanceof SourceError && err.code === 'NOT_FOUND',
  );
});

test('appendToPage issues a PATCH with the content', async () => {
  const { fetchImpl, calls } = mockFetch(() => ({ ok: true, status: 200 }));
  const connector = new HttpNotionConnector({ apiKey: 'secret', fetchImpl });

  await connector.appendToPage({ pageIdOrUrl: PAGE_ID, content: 'Saved weekly summary.' });

  const init = calls[0]?.init as { method?: string; body?: string } | undefined;
  assert.equal(init?.method, 'PATCH');
  assert.match(init?.body ?? '', /Saved weekly summary\./);
});
