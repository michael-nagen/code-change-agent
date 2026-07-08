import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { JsonFileVideoStore, validateLibraryFile } from '../videoStore.js';
import { seedVideos } from '../seedVideos.js';

async function tmpLibraryPath(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'video-store-'));
  return join(dir, 'library.json');
}

test('persists and reloads the library across store instances', async () => {
  const filePath = await tmpLibraryPath();
  const store = new JsonFileVideoStore({ filePath });

  await store.save({ videos: seedVideos(), lastDailySendDate: '2026-07-08' });

  const reloaded = await new JsonFileVideoStore({ filePath }).load();
  assert.equal(reloaded.videos.length, seedVideos().length);
  assert.equal(reloaded.lastDailySendDate, '2026-07-08');
});

test('a missing file means an empty library', async () => {
  const store = new JsonFileVideoStore({ filePath: await tmpLibraryPath() });
  assert.deepEqual(await store.load(), { videos: [] });
});

test('atomic write leaves no temp files behind', async () => {
  const filePath = await tmpLibraryPath();
  const store = new JsonFileVideoStore({ filePath });

  await store.save({ videos: seedVideos() });

  const files = await readdir(join(filePath, '..'));
  assert.deepEqual(files, ['library.json']);
});

test('a corrupted file fails closed with a clear error', async () => {
  const filePath = await tmpLibraryPath();
  await writeFile(filePath, 'not json{', 'utf8');

  await assert.rejects(
    () => new JsonFileVideoStore({ filePath }).load(),
    /not valid JSON/,
  );
});

test('validation rejects malformed entries', () => {
  assert.throws(
    () => validateLibraryFile({ videos: [{ id: 'x', title: 'T', youtubeUrl: 'u', category: 'nope', addedAt: 'now', source: 'seed', status: 'available' }] }),
    /category must be one of/,
  );
  assert.throws(() => validateLibraryFile({ videos: 'nope' }), /must be an array/);
});
