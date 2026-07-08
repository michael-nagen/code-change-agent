/**
 * Daily AI Video commands: send the next unsent learning video, show library
 * counts, and run discovery on demand. No LLM anywhere in this path.
 *
 * Send-vs-mark semantics: for these user-initiated commands the video IS the
 * reply, delivered by the webhook after the handler returns, so the video is
 * marked sent when the reply is composed. The strict deliver-then-mark path
 * (`VideoLibraryService.sendNextVideo`) is used by the automated daily send,
 * where an unattended delivery failure must leave the video available.
 */
import { plainReply } from '../reply.js';
import type { TelegramReply } from '../types.js';
import type { HandlerContext } from './context.js';
import type { LearningVideo } from '../../videos/index.js';

/** The Telegram message for one video, per the fixed simple format. */
export function formatVideoMessage(video: LearningVideo): string {
  return [
    '🎥 Daily AI Video',
    '',
    `Title: ${video.title}`,
    `Category: ${video.category}`,
    `Channel: ${video.channelName ?? 'unknown'}`,
    '',
    'Watch:',
    video.youtubeUrl,
  ].join('\n');
}

const NO_VIDEOS_MESSAGE =
  'No unsent videos left in the library. Run /refresh_videos to discover new ones.';

async function sendNextAsReply(ctx: HandlerContext): Promise<TelegramReply> {
  const next = await ctx.videos.peekNext();
  if (next === undefined) {
    return plainReply(NO_VIDEOS_MESSAGE);
  }
  await ctx.videos.markSent(next.id);
  return plainReply(formatVideoMessage(next));
}

export async function videoTodayHandler(ctx: HandlerContext): Promise<TelegramReply> {
  return sendNextAsReply(ctx);
}

export async function moreVideoHandler(ctx: HandlerContext): Promise<TelegramReply> {
  return sendNextAsReply(ctx);
}

export async function videosStatusHandler(ctx: HandlerContext): Promise<TelegramReply> {
  const status = await ctx.videos.status();
  return plainReply(
    [
      '🎥 Video library',
      '',
      `Available: ${status.available}`,
      `Sent: ${status.sent}`,
      `Skipped: ${status.skipped}`,
      `Total: ${status.total}`,
    ].join('\n'),
  );
}

export async function refreshVideosHandler(ctx: HandlerContext): Promise<TelegramReply> {
  await ctx.progress('🔎 Searching for new videos…');
  const result = await ctx.videos.refresh();
  const failed =
    result.failedQueries.length > 0
      ? `\nFailed queries: ${result.failedQueries.length} (discovery fails open — existing videos are unaffected).`
      : '';
  return plainReply(
    `🎥 Discovery done: added ${result.added} new video${result.added === 1 ? '' : 's'}, skipped ${result.duplicates} duplicate${result.duplicates === 1 ? '' : 's'}.${failed}`,
  );
}

export async function videoHelpHandler(): Promise<TelegramReply> {
  return plainReply(
    [
      '🎥 Daily AI Video commands',
      '',
      '/video_today — send one unsent video now',
      '/more_video — send another unsent video',
      '/videos_status — library counts (available/sent)',
      '/refresh_videos — discover and add new videos',
      '/video_help — this list',
    ].join('\n'),
  );
}
