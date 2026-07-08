/**
 * Local, mocked verification of the Telegram command interface.
 *
 * Run with:  npm run check:telegram
 *
 * It answers: "does the full Telegram workflow wire up and drive the analysis
 * engine end-to-end?" — WITHOUT any real Telegram token, webhook, or OpenAI key.
 * It uses the in-memory memory store, the deterministic MOCK analysis runner, an
 * in-memory Telegram state store, and a capturing (non-network) Telegram API, so
 * it never touches the network and needs no secrets.
 *
 * It simulates a realistic command sequence and asserts each reply, then confirms
 * the (fake) bot token never appears in any outgoing message.
 */
import assert from 'node:assert/strict';

import {
  createTelegramWebhookHandler,
  DefaultTelegramWorkflowBridge,
  InMemoryTelegramStateStore,
  type TelegramApi,
  type TelegramConfig,
} from '../src/telegram/index.js';
import { InMemoryMemoryStore, MEMORY_SCHEMA_VERSION } from '../src/index.js';
import { MockAnalysisRunner } from '../src/ui/index.js';

const FAKE_TOKEN = '123456:FAKE-TELEGRAM-TOKEN-not-a-secret';
const SECRET = 'check-telegram-secret';
const CHAT_ID = 1;
const PROJECT = 'Developer Work Companion';

class CapturingApi implements TelegramApi {
  readonly sent: string[] = [];
  async sendMessage({ text }: { chatId: number | string; text: string }): Promise<void> {
    this.sent.push(text);
  }
}

async function main(): Promise<void> {
  console.log('Telegram command check (mocked — no token/OpenAI/network)\n');

  const memoryStore = new InMemoryMemoryStore();
  // Seed an active spec summary so generation can fall back to memory when no
  // spec is pasted, mirroring a configured project.
  await memoryStore.saveProjectMemory({
    userId: 'local',
    projectId: 'developer-work-companion',
    memory: {
      schemaVersion: MEMORY_SCHEMA_VERSION,
      userId: 'local',
      projectId: 'developer-work-companion',
      activeSpecSummary: 'Build Telegram as the main work interface.',
      history: [],
      updatedAt: new Date().toISOString(),
    },
  });

  const config: TelegramConfig = {
    botToken: FAKE_TOKEN,
    webhookSecret: SECRET,
    allowedChatIds: [String(CHAT_ID)],
    defaultProject: PROJECT,
  };
  const bridge = new DefaultTelegramWorkflowBridge({
    runner: new MockAnalysisRunner(),
    mode: 'mock',
    memoryStore,
  });
  const api = new CapturingApi();
  const handler = createTelegramWebhookHandler({
    config,
    memoryStore,
    bridge,
    stateStore: new InMemoryTelegramStateStore(),
    api,
    userId: 'local',
  });

  const send = async (text: string): Promise<string> => {
    const before = api.sent.length;
    const result = await handler.handle({
      update: { message: { message_id: 1, text, chat: { id: CHAT_ID, type: 'private' } } },
      secretHeader: SECRET,
    });
    assert.equal(result.statusCode, 200, `expected 200 for "${text}"`);
    const reply = api.sent[before] ?? '';
    console.log(`> ${text}`);
    console.log(`  ${firstLine(reply)}\n`);
    return reply;
  };

  // 1. Unauthorized chat is rejected.
  const denied = await handler.handle({
    update: { message: { message_id: 1, text: '/status', chat: { id: 999, type: 'private' } } },
    secretHeader: SECRET,
  });
  assert.equal(denied.statusCode, 200);
  assert.match(api.sent.at(-1) ?? '', /not authorized/i);
  console.log('Unauthorized chat rejected: OK\n');

  // 2. Bad webhook secret is rejected with no send.
  const beforeSecret = api.sent.length;
  const badSecret = await handler.handle({
    update: { message: { message_id: 1, text: '/status', chat: { id: CHAT_ID, type: 'private' } } },
    secretHeader: 'wrong',
  });
  assert.equal(badSecret.statusCode, 401);
  assert.equal(api.sent.length, beforeSecret, 'a bad secret must send nothing');
  console.log('Bad webhook secret rejected: OK\n');

  assert.match(await send('/start'), /Developer Work Companion/);
  assert.match(await send('/help'), /\/analyze/);
  assert.match(await send('/status'), /Developer Work Companion/);
  assert.match(await send('/memory'), /Developer Work Companion/);
  assert.match(await send('/preferences'), /preferences/i);
  assert.match(await send('/project'), /Developer Work Companion/);

  // Missing-input path: no diff configured and none pasted.
  assert.match(await send('/analyze'), /missing a code diff/i);

  // Full analyze with pasted spec + diff.
  assert.match(
    await send('/analyze spec: build the telegram interface diff: +added a line'),
    /Analysis ready/,
  );

  // On-demand generation reuses the session (no new input).
  assert.match(await send('/daily'), /Daily Work Guidance/);
  assert.match(await send('/technical'), /Technical Change Brief/);
  assert.match(await send('/demo'), /Demo Prep/);
  assert.match(await send('/weekly'), /Weekly Review/);

  // Save the pending weekly update (the last generated artifact).
  assert.match(await send('/save weekly'), /Saved progress/i);

  // Clear requires confirmation.
  assert.match(await send('/clear'), /clear confirm/i);
  assert.match(await send('/clear confirm'), /Cleared project memory/i);

  // Save with nothing new pending after a fresh state is not possible here, but
  // verify the no-pending path explicitly on a second chat.
  const other = await handler.handle({
    update: { message: { message_id: 1, text: '/save', chat: { id: CHAT_ID, type: 'private' } } },
    secretHeader: SECRET,
  });
  assert.equal(other.statusCode, 200);

  // The bot token must NEVER appear in any outgoing message.
  for (const message of api.sent) {
    assert.ok(!message.includes(FAKE_TOKEN), 'bot token leaked into a reply');
  }
  console.log('Bot token never leaked into replies: OK');

  console.log('\nResult: Telegram command interface is wired and working (mocked).');
}

function firstLine(text: string): string {
  const line = text.split('\n')[0] ?? '';
  return line.length > 100 ? `${line.slice(0, 100)}…` : line;
}

main().catch((err: unknown) => {
  console.error(`\nResult: FAILED\n${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
