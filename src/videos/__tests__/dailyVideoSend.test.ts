import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runDailyVideoTick, isPastSendTime } from '../dailyVideoSend.js';
import { VideoLibraryService } from '../videoLibrary.js';
import { InMemoryVideoStore } from '../videoStore.js';
import { seedVideos } from '../seedVideos.js';

/** A local time on a fixed day. */
function at(hourMinute: string): Date {
  return new Date(`2026-07-08T${hourMinute}:00`);
}

function library(): VideoLibraryService {
  return new VideoLibraryService({ store: new InMemoryVideoStore({ videos: seedVideos() }) });
}

test('nothing is sent before the configured time', async () => {
  const lib = library();
  const outcome = await runDailyVideoTick({
    videoLibrary: lib,
    deliver: async () => assert.fail('must not deliver before the send time'),
    now: at('08:59'),
    sendTime: '09:00',
  });
  assert.equal(outcome, 'not_due');
});

test('sends exactly one video per day, marking it sent', async () => {
  const lib = library();
  const delivered: string[] = [];
  const deliver = async (v: { id: string }): Promise<void> => {
    delivered.push(v.id);
  };

  assert.equal(
    await runDailyVideoTick({ videoLibrary: lib, deliver, now: at('09:01'), sendTime: '09:00' }),
    'sent',
  );
  // Later ticks the same day do nothing.
  assert.equal(
    await runDailyVideoTick({ videoLibrary: lib, deliver, now: at('15:00'), sendTime: '09:00' }),
    'already_sent',
  );
  assert.deepEqual(delivered, ['seed-1']);
  assert.equal((await lib.status()).sent, 1);
});

test('a failed delivery is not retried that day, but the video stays available', async () => {
  const lib = library();

  const outcome = await runDailyVideoTick({
    videoLibrary: lib,
    deliver: async () => {
      throw new Error('telegram down');
    },
    now: at('09:01'),
    sendTime: '09:00',
  });

  assert.equal(outcome, 'failed');
  // No retry-spam: the day is consumed…
  assert.equal(
    await runDailyVideoTick({
      videoLibrary: lib,
      deliver: async () => assert.fail('must not retry the same day'),
      now: at('10:00'),
      sendTime: '09:00',
    }),
    'already_sent',
  );
  // …but the video was never marked sent, so it goes tomorrow.
  assert.equal((await lib.peekNext())?.id, 'seed-1');
});

test('an empty library records the day silently', async () => {
  const lib = new VideoLibraryService({ store: new InMemoryVideoStore() });
  const outcome = await runDailyVideoTick({
    videoLibrary: lib,
    deliver: async () => assert.fail('nothing to deliver'),
    now: at('09:30'),
    sendTime: '09:00',
  });
  assert.equal(outcome, 'empty');
});

test('isPastSendTime respects hours and minutes and rejects garbage', () => {
  assert.equal(isPastSendTime(at('09:00'), '09:00'), true);
  assert.equal(isPastSendTime(at('09:30'), '09:45'), false);
  assert.equal(isPastSendTime(at('10:00'), '09:45'), true);
  assert.equal(isPastSendTime(at('23:59'), 'nonsense'), false);
});
