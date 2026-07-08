/**
 * The video library service: pick the next unsent video, mark sends, report
 * counts, and fold discovered candidates in without duplicates. Deterministic
 * and LLM-free; every operation loads → mutates → saves the single small
 * library document through the injected store.
 */
import { randomUUID } from 'node:crypto';
import type {
  LearningVideo,
  LearningVideoCandidate,
  VideoStore,
  YouTubeVideoSearch,
} from './types.js';

/** The standing discovery queries used by weekly/manual refresh. */
export const DISCOVERY_QUERIES: readonly string[] = [
  'Claude Code tutorial',
  'Claude Code tips',
  'Cursor AI coding workflow',
  'AI coding agents tutorial',
  'MCP tools Claude tutorial',
  'prompt engineering for coding agents',
  'AI code review workflow',
];

export interface VideoLibraryStatus {
  available: number;
  sent: number;
  skipped: number;
  total: number;
}

export interface RefreshResult {
  added: number;
  duplicates: number;
  /** Queries whose search failed; discovery fails open, never the command. */
  failedQueries: string[];
}

export class VideoLibraryService {
  private readonly store: VideoStore;
  private readonly search: YouTubeVideoSearch | undefined;

  constructor({ store, search }: { store: VideoStore; search?: YouTubeVideoSearch }) {
    this.store = store;
    this.search = search;
  }

  /** One-time bootstrap: fill a brand-new (empty) library with the seed list. */
  async seedIfEmpty(seed: readonly LearningVideo[]): Promise<void> {
    const file = await this.store.load();
    if (file.videos.length > 0) return;
    file.videos = [...seed];
    await this.store.save(file);
  }

  /** The next unsent video (oldest first), without changing any state. */
  async peekNext(): Promise<LearningVideo | undefined> {
    const { videos } = await this.store.load();
    return videos.find((video) => video.status === 'available');
  }

  /** Mark a video sent. Call only after the message was actually delivered. */
  async markSent(id: string, sentAt = new Date().toISOString()): Promise<void> {
    const file = await this.store.load();
    const video = file.videos.find((entry) => entry.id === id);
    if (video === undefined) {
      throw new Error(`Unknown video id: ${id}`);
    }
    video.status = 'sent';
    video.sentAt = sentAt;
    await this.store.save(file);
  }

  /**
   * Deliver the next unsent video through `deliver`, then mark it sent. The
   * mark happens ONLY after `deliver` resolves, so a failed delivery leaves
   * the video available for the next attempt. Returns undefined when the
   * library has nothing left to send.
   */
  async sendNextVideo({
    deliver,
  }: {
    deliver: (video: LearningVideo) => Promise<void>;
  }): Promise<LearningVideo | undefined> {
    const next = await this.peekNext();
    if (next === undefined) return undefined;
    await deliver(next);
    await this.markSent(next.id);
    return next;
  }

  async status(): Promise<VideoLibraryStatus> {
    const { videos } = await this.store.load();
    const count = (status: LearningVideo['status']): number =>
      videos.filter((video) => video.status === status).length;
    return {
      available: count('available'),
      sent: count('sent'),
      skipped: count('skipped'),
      total: videos.length,
    };
  }

  /** Add candidates, skipping anything already in the library. */
  async addCandidates(
    candidates: readonly LearningVideoCandidate[],
    source: LearningVideo['source'],
  ): Promise<{ added: number; duplicates: number }> {
    const file = await this.store.load();
    const seen = new Set(file.videos.map((video) => dedupeKey(video)));
    let added = 0;
    let duplicates = 0;
    for (const candidate of candidates) {
      const key = dedupeKey(candidate);
      if (seen.has(key)) {
        duplicates += 1;
        continue;
      }
      seen.add(key);
      file.videos.push({
        id: randomUUID(),
        title: candidate.title,
        youtubeUrl: candidate.youtubeUrl,
        category: candidate.category,
        addedAt: new Date().toISOString(),
        source,
        status: 'available',
        ...(candidate.channelName !== undefined ? { channelName: candidate.channelName } : {}),
      });
      added += 1;
    }
    if (added > 0) {
      await this.store.save(file);
    }
    return { added, duplicates };
  }

  /**
   * Run discovery across the standing queries. Each query fails open: a
   * broken search never breaks the library or /video_today. Without a search
   * provider this reports every query as failed rather than pretending.
   */
  async refresh({
    queries = DISCOVERY_QUERIES,
    perQueryLimit = 3,
  }: { queries?: readonly string[]; perQueryLimit?: number } = {}): Promise<RefreshResult> {
    if (this.search === undefined) {
      return { added: 0, duplicates: 0, failedQueries: [...queries] };
    }
    const candidates: LearningVideoCandidate[] = [];
    const failedQueries: string[] = [];
    for (const query of queries) {
      try {
        candidates.push(...(await this.search.search({ query, limit: perQueryLimit })));
      } catch {
        failedQueries.push(query);
      }
    }
    const { added, duplicates } = await this.addCandidates(candidates, 'youtube_search');
    return { added, duplicates, failedQueries };
  }

  /** Whether the automated daily send already happened for `date` (YYYY-MM-DD). */
  async dailySendDoneFor(date: string): Promise<boolean> {
    const file = await this.store.load();
    return file.lastDailySendDate === date;
  }

  /** Record that the automated daily send happened for `date`. */
  async recordDailySend(date: string): Promise<void> {
    const file = await this.store.load();
    file.lastDailySendDate = date;
    await this.store.save(file);
  }
}

/**
 * Dedupe identity: the YouTube video id when the URL carries one, else the
 * normalized URL, else the lowercased title.
 */
export function dedupeKey(video: { youtubeUrl: string; title: string }): string {
  const videoId = extractYouTubeVideoId(video.youtubeUrl);
  if (videoId !== undefined) return `id:${videoId}`;
  const normalized = video.youtubeUrl
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');
  if (normalized !== '') return `url:${normalized}`;
  return `title:${video.title.trim().toLowerCase()}`;
}

/** Extract the video id from the common YouTube URL shapes. */
export function extractYouTubeVideoId(url: string): string | undefined {
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{6,})/, // youtube.com/watch?v=ID
    /youtu\.be\/([A-Za-z0-9_-]{6,})/, // youtu.be/ID
    /youtube\.com\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{6,})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1] !== undefined) return match[1];
  }
  return undefined;
}
