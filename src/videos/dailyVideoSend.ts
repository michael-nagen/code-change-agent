/**
 * The automated once-per-day video send. A periodic tick calls
 * `runDailyVideoTick`; it decides whether the send is due and performs at most
 * ONE delivery attempt per calendar day:
 *  - the day is recorded BEFORE the attempt, so a failed delivery is not
 *    retried until tomorrow (no spam), while the video itself is only marked
 *    sent after a successful delivery (so it is not lost);
 *  - an empty library records the day silently rather than messaging daily.
 */
import type { VideoLibraryService } from './videoLibrary.js';
import type { LearningVideo } from './types.js';

export type DailyVideoTickOutcome = 'sent' | 'not_due' | 'already_sent' | 'empty' | 'failed';

/** Whether local `now` has reached the HH:MM send time. */
export function isPastSendTime(now: Date, sendTime: string): boolean {
  const [hourRaw, minuteRaw] = sendTime.split(':');
  const hour = Number.parseInt(hourRaw ?? '', 10);
  const minute = Number.parseInt(minuteRaw ?? '0', 10);
  if (Number.isNaN(hour)) return false;
  return now.getHours() > hour || (now.getHours() === hour && now.getMinutes() >= (Number.isNaN(minute) ? 0 : minute));
}

/** Local calendar date as YYYY-MM-DD (daily sends follow the server's clock). */
export function localDateOf(now: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export async function runDailyVideoTick({
  videoLibrary,
  deliver,
  now,
  sendTime,
}: {
  videoLibrary: VideoLibraryService;
  deliver: (video: LearningVideo) => Promise<void>;
  now: Date;
  /** HH:MM local time after which the daily send is due. */
  sendTime: string;
}): Promise<DailyVideoTickOutcome> {
  if (!isPastSendTime(now, sendTime)) return 'not_due';
  const today = localDateOf(now);
  if (await videoLibrary.dailySendDoneFor(today)) return 'already_sent';

  // One attempt per day: record first so a failure never turns into a
  // retry loop; the video stays available for tomorrow's attempt.
  await videoLibrary.recordDailySend(today);
  try {
    const sent = await videoLibrary.sendNextVideo({ deliver });
    return sent === undefined ? 'empty' : 'sent';
  } catch {
    return 'failed';
  }
}
