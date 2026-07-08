/**
 * The explicit Notion write-back service.
 *
 * It is the ONLY place that turns a chosen artifact into appended Notion
 * content. It is user-triggered per call — there is NO auto-write, no write on
 * generation, and no background sync. It reuses the injected `NotionConnector`
 * (the same one used for reading) via its optional `appendToPage`; it never
 * constructs a second Notion client and never writes to GitHub.
 *
 * Safety:
 *  - fails closed with a clear error when Notion is not configured or no target
 *    page is resolvable;
 *  - refuses to write when the requested artifact is absent (never invents
 *    content);
 *  - the API key lives on the connector, so it is never seen or logged here.
 */
import { NotionWriteBackError } from '../errors/NotionWriteBackError.js';
import type { NotionConnector } from '../sources/index.js';
import type { AnalysisResult } from '../analysis/index.js';
import type { ProjectMemory } from '../memory/index.js';
import {
  formatDailyForNotion,
  formatWeeklyForNotion,
  formatDemoForNotion,
  formatMemorySnapshotForNotion,
  type NotionWriteContent,
} from './formatNotionWriteBack.js';

/** The artifact a Notion write-back can send, keyed like the analysis result. */
export type NotionWriteBackSource =
  | 'dailyWorkGuidance'
  | 'weeklyReview'
  | 'demoPrepLoop'
  | 'projectMemory';

/** The valid write-back sources, for input validation. */
export const NOTION_WRITE_BACK_SOURCES: readonly NotionWriteBackSource[] = [
  'dailyWorkGuidance',
  'weeklyReview',
  'demoPrepLoop',
  'projectMemory',
];

/** Narrow an arbitrary string to a supported write-back source. */
export function isNotionWriteBackSource(value: string): value is NotionWriteBackSource {
  return (NOTION_WRITE_BACK_SOURCES as readonly string[]).includes(value);
}

/** A single write-back request. Exactly the inputs the chosen source needs. */
export interface NotionWriteBackRequest {
  source: NotionWriteBackSource;
  /** Carries the daily/weekly/demo artifacts; required for those sources. */
  result?: AnalysisResult;
  /** The saved project memory; required for the `projectMemory` source. */
  projectMemory?: ProjectMemory;
  /** Optional page id/URL override; falls back to the configured default page. */
  pageIdOrUrl?: string;
  /** ISO timestamp for deterministic dating in titles. Defaults to now. */
  now?: string;
}

/** The outcome of a successful write-back. */
export interface NotionWriteBackResult {
  /** The title that headed the appended content (for user confirmation). */
  title: string;
}

// Notion caps a single rich-text run at 2000 characters; stay comfortably under
// it and split long content into multiple appended paragraphs on line breaks.
const MAX_CHUNK_CHARS = 1800;

export class NotionWriteBackService {
  private readonly connector: NotionConnector | undefined;
  private readonly defaultPageId: string | undefined;
  private readonly maxChunkChars: number;

  constructor({
    connector,
    defaultPageId,
    maxChunkChars = MAX_CHUNK_CHARS,
  }: {
    connector?: NotionConnector;
    defaultPageId?: string;
    maxChunkChars?: number;
  }) {
    this.connector = connector;
    this.defaultPageId = trimToUndefined(defaultPageId);
    this.maxChunkChars = maxChunkChars;
  }

  /** Whether a connector with write capability is wired for this deployment. */
  isConfigured(): boolean {
    return this.connector?.appendToPage !== undefined;
  }

  /**
   * Append the chosen artifact to the target Notion page. Throws
   * `NotionWriteBackError` for config/target/artifact problems; a connector
   * (network/API) failure propagates as the connector's own error. Never logs
   * secrets.
   */
  async write(request: NotionWriteBackRequest): Promise<NotionWriteBackResult> {
    const append = this.connector?.appendToPage;
    if (append === undefined) {
      throw new NotionWriteBackError(
        'NOT_CONFIGURED',
        'Notion write-back is not configured. Set SOURCE_INTEGRATIONS_ENABLED=true and NOTION_API_KEY to enable it.',
      );
    }

    const pageIdOrUrl = trimToUndefined(request.pageIdOrUrl) ?? this.defaultPageId;
    if (pageIdOrUrl === undefined) {
      throw new NotionWriteBackError(
        'NO_PAGE',
        'No Notion page to write to. Set NOTION_DEFAULT_PAGE_ID or pass a page id/URL with the request.',
      );
    }

    const content = this.buildContent(request);
    const full = `${content.title}\n\n${content.body}`.trim();
    for (const chunk of chunkOnLineBreaks(full, this.maxChunkChars)) {
      await append.call(this.connector, { pageIdOrUrl, content: chunk });
    }
    return { title: content.title };
  }

  /** Build the title + body for the requested source, or fail if it is absent. */
  private buildContent(request: NotionWriteBackRequest): NotionWriteContent {
    const now = request.now ?? new Date().toISOString();
    switch (request.source) {
      case 'dailyWorkGuidance': {
        const guidance = request.result?.dailyWorkGuidance;
        if (guidance === undefined) {
          throw new NotionWriteBackError(
            'MISSING_ARTIFACT',
            'Generate Daily Work Guidance first — there is nothing to send to Notion.',
          );
        }
        return formatDailyForNotion({ guidance, now });
      }
      case 'weeklyReview': {
        const review = request.result?.weeklyReview;
        if (review === undefined) {
          throw new NotionWriteBackError(
            'MISSING_ARTIFACT',
            'Generate the Weekly Review first — there is nothing to send to Notion.',
          );
        }
        return formatWeeklyForNotion({ review, now });
      }
      case 'demoPrepLoop': {
        const demo = request.result?.demoPrepLoop;
        if (demo === undefined) {
          throw new NotionWriteBackError(
            'MISSING_ARTIFACT',
            'Generate the Demo Prep Loop first — there is nothing to send to Notion.',
          );
        }
        return formatDemoForNotion({ demo, now });
      }
      case 'projectMemory': {
        const memory = request.projectMemory;
        if (memory === undefined) {
          throw new NotionWriteBackError(
            'MISSING_ARTIFACT',
            'No saved project memory to send. Save a snapshot first, then send it to Notion.',
          );
        }
        return formatMemorySnapshotForNotion({ memory, now });
      }
      default: {
        const exhaustive: never = request.source;
        throw new NotionWriteBackError('MISSING_ARTIFACT', `Unsupported source: ${String(exhaustive)}`);
      }
    }
  }
}

/**
 * Split text into chunks no longer than `maxChars`, preferring to break on
 * newlines so paragraphs stay intact. A single over-long line is hard-split.
 */
export function chunkOnLineBreaks(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return text === '' ? [] : [text];
  const chunks: string[] = [];
  let current = '';
  for (const line of text.split('\n')) {
    if (line.length > maxChars) {
      if (current !== '') {
        chunks.push(current);
        current = '';
      }
      for (let i = 0; i < line.length; i += maxChars) {
        chunks.push(line.slice(i, i + maxChars));
      }
      continue;
    }
    const candidate = current === '' ? line : `${current}\n${line}`;
    if (candidate.length > maxChars) {
      chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current !== '') chunks.push(current);
  return chunks;
}

function trimToUndefined(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}
