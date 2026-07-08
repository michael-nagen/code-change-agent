/**
 * Types for the Daily AI Video feature: a small persistent library of YouTube
 * videos about AI-assisted development, sent one per day (or on demand) over
 * the existing Telegram channel. No LLM is involved anywhere in this feature.
 */

export type VideoCategory =
  | 'claude'
  | 'cursor'
  | 'ai-coding'
  | 'agents'
  | 'mcp-tools'
  | 'prompting'
  | 'code-review'
  | 'debugging'
  | 'other';

export type VideoSource = 'seed' | 'youtube_search' | 'manual';

export type VideoStatus = 'available' | 'sent' | 'skipped';

export interface LearningVideo {
  id: string;
  title: string;
  youtubeUrl: string;
  channelName?: string;
  category: VideoCategory;
  /** ISO timestamp the video entered the library. */
  addedAt: string;
  source: VideoSource;
  status: VideoStatus;
  /** ISO timestamp of the successful send, once sent. */
  sentAt?: string;
}

/** A discovered video before it is deduped into the library. */
export interface LearningVideoCandidate {
  title: string;
  youtubeUrl: string;
  channelName?: string;
  category: VideoCategory;
}

/** The single persisted document: the library plus daily-send bookkeeping. */
export interface VideoLibraryFile {
  videos: LearningVideo[];
  /** YYYY-MM-DD of the last automated daily send, so it never double-sends. */
  lastDailySendDate?: string;
}

/** Persistence port for the library — file-backed in production, in-memory in tests. */
export interface VideoStore {
  load(): Promise<VideoLibraryFile>;
  save(file: VideoLibraryFile): Promise<void>;
}

/** Narrow search port; the real implementation uses the YouTube Data API. */
export interface YouTubeVideoSearch {
  search(args: { query: string; limit: number }): Promise<LearningVideoCandidate[]>;
}
