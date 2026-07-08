import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createTelegramWebhookHandler } from '../createTelegramWebhookHandler.js';
import { TelegramCommandService } from '../TelegramCommandService.js';
import { InMemoryMemoryStore } from '../../memory/index.js';
import {
  InMemoryVideoStore,
  MockYouTubeVideoSearch,
  VideoLibraryService,
  seedVideos,
} from '../../videos/index.js';
import type {
  AnswerCallbackQueryInput,
  EditMessageTextInput,
  SendMessageInput,
  TelegramApi,
  TelegramConfig,
} from '../types.js';

const CONFIG: TelegramConfig = {
  botToken: 'test-token',
  allowedChatIds: ['42'],
};

class CapturingApi implements TelegramApi {
  readonly sent: Array<{ chatId: number | string; text: string }> = [];
  private nextId = 1;

  async sendMessage(input: SendMessageInput): Promise<{ messageId?: number }> {
    this.sent.push({ chatId: input.chatId, text: input.text });
    return { messageId: this.nextId++ };
  }
  async editMessageText(_input: EditMessageTextInput): Promise<void> {}
  async answerCallbackQuery(_input: AnswerCallbackQueryInput): Promise<void> {}
}

function seededLibrary(search = new MockYouTubeVideoSearch()): VideoLibraryService {
  return new VideoLibraryService({
    store: new InMemoryVideoStore({ videos: seedVideos() }),
    search,
  });
}

function service(videoLibrary: VideoLibraryService): TelegramCommandService {
  return new TelegramCommandService({
    memoryStore: new InMemoryMemoryStore(),
    config: CONFIG,
    videoLibrary,
  });
}

async function send(svc: TelegramCommandService, text: string): Promise<string> {
  const reply = await svc.handleMessage({ text, chatId: '42' });
  return reply.messages.map((m) => m.text).join('\n');
}

test('/video_today sends one video in the fixed format and marks it sent', async () => {
  const library = seededLibrary();
  const svc = service(library);

  const text = await send(svc, '/video_today');

  assert.match(text, /🎥 Daily AI Video/);
  assert.match(text, /Title: Intro to Large Language Models/);
  assert.match(text, /Category: other/);
  assert.match(text, /Channel: Andrej Karpathy/);
  assert.match(text, /Watch:\nhttps:\/\/www\.youtube\.com\/watch\?v=zjkBMFhNj_g/);
  assert.equal((await library.status()).sent, 1);
});

test('/more_video sends a different unsent video — no repeats', async () => {
  const svc = service(seededLibrary());

  const first = await send(svc, '/video_today');
  const second = await send(svc, '/more_video');

  assert.notEqual(first, second);
  assert.match(second, /Title: Let's build GPT/);
});

test('an exhausted library gets a friendly message, never an error', async () => {
  const library = new VideoLibraryService({ store: new InMemoryVideoStore() });
  const svc = service(library);

  const text = await send(svc, '/video_today');

  assert.match(text, /No unsent videos left/);
  assert.match(text, /\/refresh_videos/);
});

test('/videos_status shows the counts', async () => {
  const library = seededLibrary();
  const svc = service(library);
  await send(svc, '/video_today');

  const text = await send(svc, '/videos_status');

  assert.match(text, /Available: 4/);
  assert.match(text, /Sent: 1/);
  assert.match(text, new RegExp(`Total: ${seedVideos().length}`));
});

test('/refresh_videos adds candidates once and reports duplicates on re-run', async () => {
  const library = seededLibrary();
  const svc = service(library);
  const before = (await library.status()).total;

  const first = await send(svc, '/refresh_videos');
  assert.match(first, /added \d+ new video/);
  const afterFirst = (await library.status()).total;
  assert.ok(afterFirst > before);

  const second = await send(svc, '/refresh_videos');
  assert.match(second, /added 0 new videos/);
  assert.equal((await library.status()).total, afterFirst);
});

test('discovery failure fails open and /video_today keeps working', async () => {
  const library = new VideoLibraryService({
    store: new InMemoryVideoStore({ videos: seedVideos() }),
    search: {
      async search() {
        throw new Error('search backend down');
      },
    },
  });
  const svc = service(library);

  const refresh = await send(svc, '/refresh_videos');
  assert.match(refresh, /added 0 new videos/);
  assert.match(refresh, /Failed queries: \d+/);

  const today = await send(svc, '/video_today');
  assert.match(today, /🎥 Daily AI Video/);
});

test('/video_help lists the video commands', async () => {
  const text = await send(service(seededLibrary()), '/video_help');

  for (const cmd of ['/video_today', '/more_video', '/videos_status', '/refresh_videos']) {
    assert.ok(text.includes(cmd), `missing ${cmd}`);
  }
});

test('an unauthorized chat is rejected at the webhook and touches no video state', async () => {
  const library = seededLibrary();
  const api = new CapturingApi();
  const handler = createTelegramWebhookHandler({
    config: CONFIG,
    memoryStore: new InMemoryMemoryStore(),
    videoLibrary: library,
    api,
  });

  const result = await handler.handle({
    update: {
      update_id: 1,
      message: { message_id: 1, text: '/video_today', chat: { id: 999, type: 'private' } },
    },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(api.sent.length, 1);
  assert.match(api.sent[0]?.text ?? '', /not authorized/);
  assert.equal((await library.status()).sent, 0);
});
