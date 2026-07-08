/**
 * Video library stores: in-memory for tests/defaults, JSON-file for
 * durability. The file store follows the JsonFileMemoryStore pattern: atomic
 * temp-file writes, a missing file means an empty library, and a malformed
 * file fails closed with a clear error instead of flowing bad data onward.
 */
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { LearningVideo, VideoLibraryFile, VideoStore } from './types.js';

const VALID_CATEGORIES = [
  'claude',
  'cursor',
  'ai-coding',
  'agents',
  'mcp-tools',
  'prompting',
  'code-review',
  'debugging',
  'other',
] as const;
const VALID_SOURCES = ['seed', 'youtube_search', 'manual'] as const;
const VALID_STATUSES = ['available', 'sent', 'skipped'] as const;

export const DEFAULT_VIDEO_LIBRARY_PATH = join('data', 'videos', 'library.json');

export class InMemoryVideoStore implements VideoStore {
  private file: VideoLibraryFile;

  constructor(initial: VideoLibraryFile = { videos: [] }) {
    this.file = structuredClone(initial);
  }

  async load(): Promise<VideoLibraryFile> {
    return structuredClone(this.file);
  }

  async save(file: VideoLibraryFile): Promise<void> {
    this.file = structuredClone(validateLibraryFile(file));
  }
}

export class JsonFileVideoStore implements VideoStore {
  private readonly filePath: string;

  constructor({ filePath = DEFAULT_VIDEO_LIBRARY_PATH }: { filePath?: string } = {}) {
    this.filePath = filePath;
  }

  async load(): Promise<VideoLibraryFile> {
    let raw: string;
    try {
      raw = await readFile(this.filePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { videos: [] };
      }
      throw error;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`Video library at ${this.filePath} is not valid JSON.`);
    }
    return validateLibraryFile(parsed);
  }

  async save(file: VideoLibraryFile): Promise<void> {
    const validated = validateLibraryFile(file);
    await mkdir(dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(tmp, JSON.stringify(validated, null, 2), 'utf8');
      await rename(tmp, this.filePath);
    } catch (error) {
      await unlink(tmp).catch(() => undefined);
      throw error;
    }
  }
}

/** Validate an untrusted library document; throws on any malformed entry. */
export function validateLibraryFile(raw: unknown): VideoLibraryFile {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Video library must be a JSON object.');
  }
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.videos)) {
    throw new Error('Video library "videos" must be an array.');
  }
  const videos = obj.videos.map((entry, i) => validateVideo(entry, i));
  const lastDailySendDate = obj.lastDailySendDate;
  if (lastDailySendDate !== undefined && typeof lastDailySendDate !== 'string') {
    throw new Error('Video library "lastDailySendDate" must be a string when present.');
  }
  return {
    videos,
    ...(lastDailySendDate !== undefined ? { lastDailySendDate } : {}),
  };
}

function validateVideo(raw: unknown, index: number): LearningVideo {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`videos[${index}] must be an object.`);
  }
  const v = raw as Record<string, unknown>;
  const label = `videos[${index}]`;
  const str = (key: string): string => {
    const val = v[key];
    if (typeof val !== 'string' || val.trim() === '') {
      throw new Error(`${label}.${key} must be a non-empty string.`);
    }
    return val;
  };
  const oneOf = <T extends string>(key: string, valid: readonly T[]): T => {
    const val = str(key);
    if (!(valid as readonly string[]).includes(val)) {
      throw new Error(`${label}.${key} must be one of: ${valid.join(', ')}.`);
    }
    return val as T;
  };
  const channelName = v.channelName;
  const sentAt = v.sentAt;
  if (channelName !== undefined && typeof channelName !== 'string') {
    throw new Error(`${label}.channelName must be a string when present.`);
  }
  if (sentAt !== undefined && typeof sentAt !== 'string') {
    throw new Error(`${label}.sentAt must be a string when present.`);
  }
  return {
    id: str('id'),
    title: str('title'),
    youtubeUrl: str('youtubeUrl'),
    category: oneOf('category', VALID_CATEGORIES),
    addedAt: str('addedAt'),
    source: oneOf('source', VALID_SOURCES),
    status: oneOf('status', VALID_STATUSES),
    ...(channelName !== undefined && channelName !== '' ? { channelName } : {}),
    ...(sentAt !== undefined && sentAt !== '' ? { sentAt } : {}),
  };
}
