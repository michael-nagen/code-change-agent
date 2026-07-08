import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createTelegramWebhookHandler } from '../createTelegramWebhookHandler.js';
import { isChatAllowed } from '../handleTelegramWebhook.js';
import { DefaultTelegramWorkflowBridge } from '../TelegramWorkflowBridge.js';
import { MockArtifactTextEditSkill } from '../../skills/mocks/index.js';
import { InMemoryMemoryStore } from '../../memory/index.js';
import type { MemoryStore } from '../../memory/index.js';
import { MockAnalysisRunner } from '../../ui/index.js';
import type { ProjectMemory } from '../../memory/types/index.js';
import type {
  AnswerCallbackQueryInput,
  EditMessageTextInput,
  SendMessageInput,
  TelegramApi,
  TelegramConfig,
} from '../types.js';

const PROJECT_MEMORY: ProjectMemory = {
  schemaVersion: 1,
  userId: 'local',
  projectId: 'demo',
  latestSnapshot: {
    date: '2026-07-07',
    dailySummary: 'DB memory landed; Telegram in progress.',
    updatedChecklistStatuses: [
      { item: 'DB memory', status: 'done' },
      { item: 'Telegram', status: 'in progress' },
    ],
    openBlockers: ['Need a Postgres URL for staging'],
    openDecisions: [],
    nextActions: ['Write setup docs', 'Verify end to end'],
  },
  history: [],
  updatedAt: '2026-07-07T00:00:00.000Z',
};

class CapturingApi implements TelegramApi {
  readonly sent: Array<{ chatId: number | string; text: string }> = [];
  readonly edits: EditMessageTextInput[] = [];
  readonly answered: AnswerCallbackQueryInput[] = [];
  private nextId = 1;

  async sendMessage(input: SendMessageInput): Promise<{ messageId?: number }> {
    this.sent.push({ chatId: input.chatId, text: input.text });
    return { messageId: this.nextId++ };
  }
  async editMessageText(input: EditMessageTextInput): Promise<void> {
    this.edits.push(input);
  }
  async answerCallbackQuery(input: AnswerCallbackQueryInput): Promise<void> {
    this.answered.push(input);
  }
}

const BASE_CONFIG: TelegramConfig = {
  botToken: 'test-token',
  webhookSecret: 'secret',
  allowedChatIds: ['42'],
  defaultProject: 'demo',
};

function setup(overrides?: {
  config?: Partial<TelegramConfig>;
  seed?: boolean;
}): { api: CapturingApi; store: MemoryStore; handler: ReturnType<typeof createTelegramWebhookHandler> } {
  const api = new CapturingApi();
  const store = new InMemoryMemoryStore();
  const config: TelegramConfig = { ...BASE_CONFIG, ...overrides?.config };
  const handler = createTelegramWebhookHandler({ config, memoryStore: store, api, userId: 'local' });
  if (overrides?.seed !== false) {
    void store.saveProjectMemory({ userId: 'local', projectId: 'demo', memory: PROJECT_MEMORY });
  }
  return { api, store, handler };
}

function update({ chatId, text }: { chatId: number | string; text: string }): unknown {
  return { update_id: 1, message: { message_id: 1, text, chat: { id: chatId, type: 'private' } } };
}

function replyUpdate({
  chatId,
  text,
  replyToId,
  messageId = 50,
}: {
  chatId: number | string;
  text: string;
  replyToId: number;
  messageId?: number;
}): unknown {
  return {
    update_id: 2,
    message: {
      message_id: messageId,
      text,
      chat: { id: chatId, type: 'private' },
      reply_to_message: { message_id: replyToId },
    },
  };
}

/** A handler backed by the mock engine + text-edit skill (reply-to-edit works). */
function setupWithBridge(): {
  api: CapturingApi;
  handler: ReturnType<typeof createTelegramWebhookHandler>;
} {
  const api = new CapturingApi();
  const store = new InMemoryMemoryStore();
  const bridge = new DefaultTelegramWorkflowBridge({
    runner: new MockAnalysisRunner(),
    mode: 'mock',
    memoryStore: store,
    artifactTextEditSkill: new MockArtifactTextEditSkill(),
  });
  const handler = createTelegramWebhookHandler({
    config: BASE_CONFIG,
    memoryStore: store,
    bridge,
    api,
    userId: 'local',
  });
  return { api, handler };
}

function callback({ chatId, data }: { chatId: number | string; data: string }): unknown {
  return {
    update_id: 1,
    callback_query: { id: 'cb-1', data, message: { message_id: 7, chat: { id: chatId, type: 'private' } } },
  };
}

test('rejects a request with a wrong webhook secret and sends nothing', async () => {
  const { api, handler } = setup();
  const result = await handler.handle({
    update: update({ chatId: 42, text: '/status' }),
    secretHeader: 'wrong',
  });
  assert.equal(result.statusCode, 401);
  assert.equal(api.sent.length, 0);
});

test('accepts a matching webhook secret', async () => {
  const { api, handler } = setup();
  const result = await handler.handle({
    update: update({ chatId: 42, text: '/status' }),
    secretHeader: 'secret',
  });
  assert.equal(result.statusCode, 200);
  assert.equal(api.sent.length, 1);
});

test('unauthorized chat is rejected and never receives project data', async () => {
  const { api, handler } = setup();
  const result = await handler.handle({
    update: update({ chatId: 999, text: '/status' }),
    secretHeader: 'secret',
  });
  assert.equal(result.statusCode, 200);
  assert.equal(api.sent.length, 1);
  const reply = api.sent[0]?.text ?? '';
  assert.match(reply, /not authorized/i);
  assert.doesNotMatch(reply, /DB memory landed/);
});

test('/status returns the saved memory to an authorized chat', async () => {
  const { api, handler } = setup();
  await handler.handle({ update: update({ chatId: 42, text: '/status' }), secretHeader: 'secret' });
  const reply = api.sent[0]?.text ?? '';
  assert.match(reply, /DB memory landed; Telegram in progress\./);
  assert.match(reply, /Blockers:/);
  assert.match(reply, /Need a Postgres URL for staging/);
  assert.match(reply, /Write setup docs/);
});

test('/memory returns a compact snapshot', async () => {
  const { api, handler } = setup();
  await handler.handle({ update: update({ chatId: 42, text: '/memory' }), secretHeader: 'secret' });
  const reply = api.sent[0]?.text ?? '';
  assert.match(reply, /Checklist: 1\/2 done/);
  assert.match(reply, /Open blockers: 1/);
});

test('/status on an empty project explains there is no saved memory', async () => {
  const { api, handler } = setup({ seed: false });
  await handler.handle({ update: update({ chatId: 42, text: '/status' }), secretHeader: 'secret' });
  const reply = api.sent[0]?.text ?? '';
  assert.match(reply, /No saved progress yet/);
});

test('/start and /help list the commands without touching memory', async () => {
  const { api, handler } = setup({ seed: false });
  await handler.handle({ update: update({ chatId: 42, text: '/start' }), secretHeader: 'secret' });
  await handler.handle({ update: update({ chatId: 42, text: '/help' }), secretHeader: 'secret' });
  assert.match(api.sent[0]?.text ?? '', /\/status/);
  assert.match(api.sent[1]?.text ?? '', /\/memory/);
});

test('/daily reports generation is unavailable when no workflow bridge is wired', async () => {
  const { api, handler } = setup();
  await handler.handle({ update: update({ chatId: 42, text: '/daily' }), secretHeader: 'secret' });
  assert.match(api.sent[0]?.text ?? '', /not configured/i);
});

test('an unknown command falls back to help', async () => {
  const { api, handler } = setup({ seed: false });
  await handler.handle({ update: update({ chatId: 42, text: '/nope' }), secretHeader: 'secret' });
  assert.match(api.sent[0]?.text ?? '', /Unknown command/);
});

test('a non-message update is acknowledged with no send', async () => {
  const { api, handler } = setup({ seed: false });
  const result = await handler.handle({ update: { update_id: 5 }, secretHeader: 'secret' });
  assert.equal(result.statusCode, 200);
  assert.equal(api.sent.length, 0);
});

test('an inline-button tap is acknowledged and dispatched like a command', async () => {
  const { api, handler } = setup();
  const result = await handler.handle({
    update: callback({ chatId: 42, data: '/status' }),
    secretHeader: 'secret',
  });
  assert.equal(result.statusCode, 200);
  assert.equal(api.answered.length, 1, 'the callback query must be acknowledged');
  assert.match(api.sent[0]?.text ?? '', /DB memory landed/);
});

test('an unauthorized callback is acknowledged but never receives project data', async () => {
  const { api, handler } = setup();
  await handler.handle({
    update: callback({ chatId: 999, data: '/status' }),
    secretHeader: 'secret',
  });
  assert.equal(api.answered.length, 1);
  const reply = api.sent[0]?.text ?? '';
  assert.match(reply, /not authorized/i);
  assert.doesNotMatch(reply, /DB memory landed/);
});

test('a slow command shows a progress message that is edited into the result', async () => {
  const api = new CapturingApi();
  const store = new InMemoryMemoryStore();
  const bridge = new DefaultTelegramWorkflowBridge({
    runner: new MockAnalysisRunner(),
    mode: 'mock',
    memoryStore: store,
  });
  const handler = createTelegramWebhookHandler({
    config: BASE_CONFIG,
    memoryStore: store,
    bridge,
    api,
    userId: 'local',
  });

  await handler.handle({
    update: update({ chatId: 42, text: '/analyze spec: build it diff: +line' }),
    secretHeader: 'secret',
  });

  assert.equal(api.sent[0]?.text, '🔄 Running analysis…');
  assert.match(api.edits[0]?.text ?? '', /Analysis ready/);
});

test('replying to a generated artifact edits it and refreshes /latest', async () => {
  const { api, handler } = setupWithBridge();

  // Generate an analysis; its result is the message we will reply to.
  await handler.handle({
    update: update({ chatId: 42, text: '/analyze spec: build it diff: +line' }),
    secretHeader: 'secret',
  });
  // The progress message (id 1) is edited into the result and registered.
  const artifactMessageId = 1;

  await handler.handle({
    update: replyUpdate({ chatId: 42, text: 'make it shorter', replyToId: artifactMessageId }),
    secretHeader: 'secret',
  });

  // The edit shows a progress message that is edited into the revised result.
  const editText = api.edits.at(-1)?.text ?? '';
  assert.match(editText, /Edit applied to analysis summary: "make it shorter"/);
  // The edited result carries action buttons (Edit again / Latest).
  const markup = api.edits.at(-1)?.replyMarkup;
  assert.equal(markup?.kind, 'inline');

  // /latest now reflects the edited version.
  await handler.handle({ update: update({ chatId: 42, text: '/latest' }), secretHeader: 'secret' });
  assert.match(api.sent.at(-1)?.text ?? '', /Edit applied to analysis summary/);
});

test('replying to an unknown (non-artifact) message returns a friendly error', async () => {
  const { api, handler } = setupWithBridge();
  await handler.handle({
    update: replyUpdate({ chatId: 42, text: 'make it shorter', replyToId: 9999 }),
    secretHeader: 'secret',
  });
  assert.match(api.sent.at(-1)?.text ?? '', /can only edit results I generated/i);
});

test('a slash command sent as a reply is dispatched normally, not treated as an edit', async () => {
  const { api, handler } = setupWithBridge();
  await handler.handle({
    update: replyUpdate({ chatId: 42, text: '/help', replyToId: 9999 }),
    secretHeader: 'secret',
  });
  assert.match(api.sent.at(-1)?.text ?? '', /\/status/);
});

test('isChatAllowed denies everyone when the allow-list is empty', () => {
  assert.equal(isChatAllowed({ chatId: 1, allowedChatIds: [] }), false);
  assert.equal(isChatAllowed({ chatId: 1, allowedChatIds: ['1'] }), true);
  assert.equal(isChatAllowed({ chatId: 2, allowedChatIds: ['1'] }), false);
});
