import { test } from 'node:test';
import assert from 'node:assert/strict';

import { VideoLibraryService, dedupeKey, extractYouTubeVideoId } from '../videoLibrary.js';
import { InMemoryVideoStore } from '../videoStore.js';
import { seedVideos } from '../seedVideos.js';
import { MockYouTubeVideoSearch } from '../youtubeSearch.js';
import type { LearningVideo, YouTubeVideoSearch } from '../types.js';

function video(id: string, overrides: Partial<LearningVideo> = {}): LearningVideo {
  return {
    id,
    title: `Video ${id}`,
    youtubeUrl: `https://www.youtube.com/watch?v=vid-${id}-0001`,
    category: 'ai-coding',
    addedAt: `2026-01-0${id.length}T00:00:00.000Z`,
    source: 'seed',
    status: 'available',
    ...overrides,
  };
}

function service(videos: LearningVideo[], search?: YouTubeVideoSearch): VideoLibraryService {
  return new VideoLibraryService({
    store: new InMemoryVideoStore({ videos }),
    ...(search !== undefined ? { search } : {}),
  });
}

test('picks the next unsent video and never repeats a sent one', async () => {
  const lib = service([video('a'), video('b')]);

  const first = await lib.peekNext();
  assert.equal(first?.id, 'a');
  await lib.markSent('a');

  const second = await lib.peekNext();
  assert.equal(second?.id, 'b');
  await lib.markSent('b');

  assert.equal(await lib.peekNext(), undefined);
});

test('sendNextVideo marks sent only after the delivery succeeds', async () => {
  const lib = service([video('a')]);

  await assert.rejects(() =>
    lib.sendNextVideo({
      deliver: async () => {
        throw new Error('telegram down');
      },
    }),
  );
  // Failed delivery leaves the video available.
  assert.equal((await lib.peekNext())?.id, 'a');

  const delivered: string[] = [];
  const sent = await lib.sendNextVideo({
    deliver: async (v) => {
      delivered.push(v.id);
    },
  });
  assert.equal(sent?.id, 'a');
  assert.deepEqual(delivered, ['a']);
  assert.equal(await lib.peekNext(), undefined);
  assert.equal((await lib.status()).sent, 1);
});

test('status reports available/sent/skipped counts', async () => {
  const lib = service([
    video('a'),
    video('b', { status: 'sent', sentAt: '2026-01-02T00:00:00.000Z' }),
    video('c', { status: 'skipped' }),
  ]);

  assert.deepEqual(await lib.status(), { available: 1, sent: 1, skipped: 1, total: 3 });
});

test('deduplicates candidates by video id, normalized URL, and title fallback', async () => {
  const lib = service([
    video('a', { youtubeUrl: 'https://www.youtube.com/watch?v=abc123xyz' }),
    video('b', { youtubeUrl: 'not-a-youtube-url/some-path', title: 'Fallback Title' }),
  ]);

  const result = await lib.addCandidates(
    [
      // Same video id via a different URL shape.
      { title: 'Other title', youtubeUrl: 'https://youtu.be/abc123xyz', category: 'claude' },
      // Same non-YouTube URL, differently normalized.
      { title: 'Another', youtubeUrl: 'HTTP://NOT-A-YOUTUBE-URL/some-path/', category: 'other' },
      // Genuinely new.
      { title: 'Brand new', youtubeUrl: 'https://www.youtube.com/watch?v=brandnew123', category: 'agents' },
    ],
    'youtube_search',
  );

  assert.deepEqual(result, { added: 1, duplicates: 2 });
  assert.equal((await lib.status()).total, 3);
});

test('refresh discovers via the provider, dedupes on re-run, and fails open per query', async () => {
  const flaky: YouTubeVideoSearch = {
    async search({ query, limit }) {
      if (query.includes('Cursor')) throw new Error('quota exceeded');
      return new MockYouTubeVideoSearch().search({ query, limit });
    },
  };
  const lib = service([], flaky);

  const first = await lib.refresh({ queries: ['Claude Code tutorial', 'Cursor AI coding workflow'] });
  assert.ok(first.added > 0);
  assert.deepEqual(first.failedQueries, ['Cursor AI coding workflow']);

  // Re-running adds nothing new: everything dedupes.
  const second = await lib.refresh({ queries: ['Claude Code tutorial'] });
  assert.equal(second.added, 0);
  assert.equal(second.duplicates > 0, true);
});

test('refresh without a provider fails open: nothing added, queries reported', async () => {
  const lib = service([video('a')]);

  const result = await lib.refresh({ queries: ['Claude Code tips'] });

  assert.deepEqual(result, { added: 0, duplicates: 0, failedQueries: ['Claude Code tips'] });
  // /video_today keeps working regardless.
  assert.equal((await lib.peekNext())?.id, 'a');
});

test('seedIfEmpty bootstraps once and never re-seeds a populated library', async () => {
  const lib = service([]);

  await lib.seedIfEmpty(seedVideos());
  const seeded = await lib.status();
  assert.equal(seeded.total, seedVideos().length);

  await lib.markSent((await lib.peekNext())!.id);
  await lib.seedIfEmpty(seedVideos());
  const after = await lib.status();
  assert.equal(after.total, seeded.total);
  assert.equal(after.sent, 1);
});

test('extractYouTubeVideoId handles the common URL shapes', () => {
  assert.equal(extractYouTubeVideoId('https://www.youtube.com/watch?v=zjkBMFhNj_g'), 'zjkBMFhNj_g');
  assert.equal(extractYouTubeVideoId('https://youtu.be/zjkBMFhNj_g'), 'zjkBMFhNj_g');
  assert.equal(extractYouTubeVideoId('https://www.youtube.com/shorts/zjkBMFhNj_g'), 'zjkBMFhNj_g');
  assert.equal(extractYouTubeVideoId('https://example.com/video'), undefined);
  // Same id → same dedupe key regardless of URL shape.
  assert.equal(
    dedupeKey({ youtubeUrl: 'https://youtu.be/kCc8FmEb1nY', title: 'x' }),
    dedupeKey({ youtubeUrl: 'https://www.youtube.com/watch?v=kCc8FmEb1nY&t=10s', title: 'y' }),
  );
});
