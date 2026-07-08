/**
 * YouTube search providers behind the narrow `YouTubeVideoSearch` port.
 *
 * The real provider calls the official YouTube Data API v3 (no HTML scraping)
 * and requires YOUTUBE_API_KEY; the key travels only in the request URL and is
 * never logged or echoed in errors. The mock provider returns deterministic,
 * clearly-labeled placeholder candidates so /refresh_videos can be exercised
 * (and tested) without any API configuration.
 */
import type { LearningVideoCandidate, VideoCategory, YouTubeVideoSearch } from './types.js';

export type SearchFetch = (url: string) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

/** Map a discovery query to the closest library category. */
export function categoryForQuery(query: string): VideoCategory {
  const q = query.toLowerCase();
  if (q.includes('claude')) return q.includes('mcp') ? 'mcp-tools' : 'claude';
  if (q.includes('cursor')) return 'cursor';
  if (q.includes('mcp')) return 'mcp-tools';
  if (q.includes('agent')) return 'agents';
  if (q.includes('prompt')) return 'prompting';
  if (q.includes('review')) return 'code-review';
  if (q.includes('debug')) return 'debugging';
  if (q.includes('coding')) return 'ai-coding';
  return 'other';
}

export class YouTubeApiVideoSearch implements YouTubeVideoSearch {
  private readonly apiKey: string;
  private readonly fetchImpl: SearchFetch;

  constructor({ apiKey, fetchImpl }: { apiKey: string; fetchImpl?: SearchFetch }) {
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl ?? ((url) => fetch(url));
  }

  async search({ query, limit }: { query: string; limit: number }): Promise<LearningVideoCandidate[]> {
    const url =
      'https://www.googleapis.com/youtube/v3/search' +
      `?part=snippet&type=video&maxResults=${Math.max(1, Math.min(limit, 10))}` +
      `&q=${encodeURIComponent(query)}&key=${encodeURIComponent(this.apiKey)}`;
    const response = await this.fetchImpl(url);
    if (!response.ok) {
      // Deliberately no URL/key in the message.
      throw new Error(`YouTube search failed with HTTP ${response.status}.`);
    }
    const body = (await response.json()) as { items?: unknown };
    const items = Array.isArray(body.items) ? body.items : [];
    const category = categoryForQuery(query);
    const candidates: LearningVideoCandidate[] = [];
    for (const item of items) {
      const entry = item as {
        id?: { videoId?: unknown };
        snippet?: { title?: unknown; channelTitle?: unknown };
      };
      const videoId = entry.id?.videoId;
      const title = entry.snippet?.title;
      if (typeof videoId !== 'string' || videoId === '' || typeof title !== 'string' || title === '') {
        continue;
      }
      const channelTitle = entry.snippet?.channelTitle;
      candidates.push({
        title,
        youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
        category,
        ...(typeof channelTitle === 'string' && channelTitle !== ''
          ? { channelName: channelTitle }
          : {}),
      });
    }
    return candidates;
  }
}

/**
 * Deterministic stand-in used when no YOUTUBE_API_KEY is configured. Its
 * candidates are clearly labeled as placeholders (the links are not real
 * videos), which keeps refresh/dedupe demonstrable without network access.
 */
export class MockYouTubeVideoSearch implements YouTubeVideoSearch {
  async search({ query, limit }: { query: string; limit: number }): Promise<LearningVideoCandidate[]> {
    const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const category = categoryForQuery(query);
    return Array.from({ length: Math.max(1, Math.min(limit, 3)) }, (_, i) => ({
      title: `[placeholder] ${query} — result ${i + 1}`,
      youtubeUrl: `https://www.youtube.com/watch?v=mock-${slug}-${i + 1}`,
      channelName: 'Mock discovery (configure YOUTUBE_API_KEY for real results)',
      category,
    }));
  }
}
