/**
 * A real-ready Notion connector.
 *
 * It calls the Notion API to read a page's top-level blocks and flatten common
 * block types into plain text, and can optionally append a paragraph (write-back).
 * Network access and the API key are injected; the key is never logged.
 *
 * MVP limitations (see docs/integrations-setup.md): only the first page of
 * top-level blocks is read (no deep recursion or pagination), and page access
 * depends on the integration being shared with the page.
 */
import { SourceError } from '../../errors/SourceError.js';
import type { NormalizedProjectSource, NotionConnector, SourceFetch } from '../types.js';
import { defaultSourceFetch } from '../types.js';

const NOTION_API = 'https://api.notion.com/v1';

export class HttpNotionConnector implements NotionConnector {
  private readonly apiKey: string;
  private readonly notionVersion: string;
  private readonly fetchImpl: SourceFetch;

  constructor({
    apiKey,
    notionVersion = '2022-06-28',
    fetchImpl,
  }: {
    apiKey: string;
    notionVersion?: string;
    fetchImpl?: SourceFetch;
  }) {
    if (apiKey.trim() === '') {
      throw new SourceError('CONFIG', 'Notion API key is required.');
    }
    this.apiKey = apiKey;
    this.notionVersion = notionVersion;
    this.fetchImpl = fetchImpl ?? defaultSourceFetch;
  }

  async readPage({ pageIdOrUrl }: { pageIdOrUrl: string }): Promise<NormalizedProjectSource> {
    const id = extractNotionPageId(pageIdOrUrl);
    const body = await this.get(`${NOTION_API}/blocks/${id}/children?page_size=100`);
    const results = Array.isArray((body as { results?: unknown }).results)
      ? ((body as { results: unknown[] }).results)
      : [];

    const lines: string[] = [];
    for (const block of results) {
      const line = blockToText(block);
      if (line !== undefined) lines.push(line);
    }
    const text = lines.join('\n').trim();

    return {
      source: {
        kind: 'notion',
        title: 'Notion page',
        id,
        ...(pageIdOrUrl.startsWith('http') ? { url: pageIdOrUrl } : {}),
        fetchedAt: new Date().toISOString(),
        confidence: 'confirmed',
      },
      text: text === '' ? '(The Notion page has no readable text blocks.)' : text,
    };
  }

  async appendToPage({ pageIdOrUrl, content }: { pageIdOrUrl: string; content: string }): Promise<void> {
    const id = extractNotionPageId(pageIdOrUrl);
    await this.patch(`${NOTION_API}/blocks/${id}/children`, {
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: { rich_text: [{ type: 'text', text: { content } }] },
        },
      ],
    });
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Notion-Version': this.notionVersion,
      'Content-Type': 'application/json',
    };
  }

  private async get(url: string): Promise<unknown> {
    let response;
    try {
      response = await this.fetchImpl(url, { headers: this.headers() });
    } catch (err) {
      throw new SourceError('FETCH', `Failed to reach Notion: ${describe(err)}`);
    }
    if (response.status === 404) {
      throw new SourceError(
        'NOT_FOUND',
        'Notion page not found. Check the page id and that the integration is shared with the page.',
      );
    }
    if (!response.ok) {
      throw new SourceError('FETCH', `Notion request failed with status ${response.status}.`);
    }
    return response.json();
  }

  private async patch(url: string, payload: unknown): Promise<void> {
    let response;
    try {
      response = await this.fetchImpl(url, {
        method: 'PATCH',
        headers: this.headers(),
        body: JSON.stringify(payload),
      });
    } catch (err) {
      throw new SourceError('FETCH', `Failed to reach Notion: ${describe(err)}`);
    }
    if (!response.ok) {
      throw new SourceError('FETCH', `Notion write failed with status ${response.status}.`);
    }
  }
}

/**
 * Extract a Notion page id (32 hex chars) from a page id or a Notion URL. The id
 * is the trailing 32-hex run in a URL slug, or the value itself if already an id.
 */
export function extractNotionPageId(pageIdOrUrl: string): string {
  // Drop any query/fragment, then remove dashes so a dashed id collapses to 32
  // hex. The trailing negative lookahead anchors each match to a run boundary so
  // a hex char in the slug can't shift the 32-char window.
  const compact = (pageIdOrUrl.split(/[?#]/)[0] ?? '').replace(/-/g, '');
  const matches = compact.match(/[0-9a-fA-F]{32}(?![0-9a-fA-F])/g);
  if (matches === null || matches.length === 0) {
    throw new SourceError('VALIDATION', `Could not find a Notion page id in "${pageIdOrUrl}".`);
  }
  return matches[matches.length - 1] as string;
}

/** Flatten a common Notion block into a single line of text, or undefined. */
function blockToText(block: unknown): string | undefined {
  if (typeof block !== 'object' || block === null) return undefined;
  const b = block as Record<string, unknown>;
  const type = typeof b.type === 'string' ? b.type : undefined;
  if (type === undefined) return undefined;

  const payload = b[type];
  if (typeof payload !== 'object' || payload === null) return undefined;
  const richText = (payload as Record<string, unknown>).rich_text;
  const text = richTextToString(richText);
  if (text === '') return undefined;

  switch (type) {
    case 'heading_1':
      return `# ${text}`;
    case 'heading_2':
      return `## ${text}`;
    case 'heading_3':
      return `### ${text}`;
    case 'bulleted_list_item':
      return `- ${text}`;
    case 'numbered_list_item':
      return `1. ${text}`;
    case 'to_do': {
      const checked = (payload as Record<string, unknown>).checked === true;
      return `- [${checked ? 'x' : ' '}] ${text}`;
    }
    case 'quote':
      return `> ${text}`;
    case 'code':
      return `\`\`\`\n${text}\n\`\`\``;
    default:
      return text;
  }
}

function richTextToString(richText: unknown): string {
  if (!Array.isArray(richText)) return '';
  const parts: string[] = [];
  for (const item of richText) {
    if (typeof item === 'object' && item !== null) {
      const plain = (item as Record<string, unknown>).plain_text;
      if (typeof plain === 'string') parts.push(plain);
    }
  }
  return parts.join('');
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
