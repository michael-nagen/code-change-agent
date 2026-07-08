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
 * It simulates a realistic command sequence — slash commands, natural-language
 * messages, and an inline-button tap — asserting each reply (following the
 * progress "🔄 …" → result edit), then confirms the (fake) bot token never
 * appears in any outgoing message.
 */
import assert from 'node:assert/strict';

import {
  createTelegramWebhookHandler,
  DefaultTelegramWorkflowBridge,
  InMemoryTelegramStateStore,
  type AnswerCallbackQueryInput,
  type EditMessageTextInput,
  type SendMessageInput,
  type TelegramApi,
  type TelegramConfig,
} from '../src/telegram/index.js';
import { InMemoryMemoryStore, MEMORY_SCHEMA_VERSION } from '../src/index.js';
import { MockAnalysisRunner } from '../src/ui/index.js';
import { MockArtifactTextEditSkill } from '../src/skills/mocks/index.js';

const FAKE_TOKEN = '123456:FAKE-TELEGRAM-TOKEN-not-a-secret';
const SECRET = 'check-telegram-secret';
const CHAT_ID = 1;
const PROJECT = 'Developer Work Companion';

interface OutgoingEvent {
  kind: 'send' | 'edit';
  text: string;
  messageId?: number;
}

class CapturingApi implements TelegramApi {
  readonly events: OutgoingEvent[] = [];
  readonly answered: AnswerCallbackQueryInput[] = [];
  private nextId = 1;

  async sendMessage({ text }: SendMessageInput): Promise<{ messageId?: number }> {
    const messageId = this.nextId++;
    this.events.push({ kind: 'send', text, messageId });
    return { messageId };
  }
  async editMessageText({ text, messageId }: EditMessageTextInput): Promise<void> {
    this.events.push({ kind: 'edit', text, messageId });
  }
  async answerCallbackQuery(input: AnswerCallbackQueryInput): Promise<void> {
    this.answered.push(input);
  }
}

async function main(): Promise<void> {
  console.log('Telegram command check (mocked — no token/OpenAI/network)\n');

  const memoryStore = new InMemoryMemoryStore();
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
    artifactTextEditSkill: new MockArtifactTextEditSkill(),
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

  /** The final rendered text of an interaction is the last outgoing event. */
  const finalText = (from: number): string => {
    const events = api.events.slice(from);
    return events.at(-1)?.text ?? '';
  };

  // The first outgoing send of a generation is the progress message that gets
  // edited into the result; it is the id the artifact is registered under, so a
  // later reply-to-edit resolves it. Track it so the check can reply to it.
  let lastArtifactId: number | undefined;

  const send = async (text: string): Promise<string> => {
    const before = api.events.length;
    const result = await handler.handle({
      update: { message: { message_id: 1, text, chat: { id: CHAT_ID, type: 'private' } } },
      secretHeader: SECRET,
    });
    assert.equal(result.statusCode, 200, `expected 200 for "${text}"`);
    lastArtifactId = api.events.slice(before).find((e) => e.kind === 'send')?.messageId;
    const reply = finalText(before);
    console.log(`> ${text}`);
    console.log(`  ${firstLine(reply)}\n`);
    return reply;
  };

  const requireArtifactId = (): number => {
    assert.ok(lastArtifactId !== undefined, 'expected a rendered artifact message id');
    return lastArtifactId;
  };

  /** Simulate replying to a bot message (the reply-to-edit flow). */
  const replyEdit = async (replyToId: number, text: string): Promise<string> => {
    const before = api.events.length;
    const result = await handler.handle({
      update: {
        message: {
          message_id: 900,
          text,
          chat: { id: CHAT_ID, type: 'private' },
          reply_to_message: { message_id: replyToId },
        },
      },
      secretHeader: SECRET,
    });
    assert.equal(result.statusCode, 200, `expected 200 for reply "${text}"`);
    const reply = finalText(before);
    console.log(`> (reply to #${replyToId}) ${text}`);
    console.log(`  ${firstLine(reply)}\n`);
    return reply;
  };

  const tap = async (data: string): Promise<string> => {
    const before = api.events.length;
    const result = await handler.handle({
      update: {
        callback_query: {
          id: 'cb-1',
          data,
          message: { message_id: 1, chat: { id: CHAT_ID, type: 'private' } },
        },
      },
      secretHeader: SECRET,
    });
    assert.equal(result.statusCode, 200, `expected 200 for tap "${data}"`);
    const reply = finalText(before);
    console.log(`[tap] ${data}`);
    console.log(`  ${firstLine(reply)}\n`);
    return reply;
  };

  // 1. Unauthorized chat is rejected.
  await handler.handle({
    update: { message: { message_id: 1, text: '/status', chat: { id: 999, type: 'private' } } },
    secretHeader: SECRET,
  });
  assert.match(api.events.at(-1)?.text ?? '', /not authorized/i);
  console.log('Unauthorized chat rejected: OK\n');

  // 2. Bad webhook secret is rejected with no send.
  const beforeSecret = api.events.length;
  const badSecret = await handler.handle({
    update: { message: { message_id: 1, text: '/status', chat: { id: CHAT_ID, type: 'private' } } },
    secretHeader: 'wrong',
  });
  assert.equal(badSecret.statusCode, 401);
  assert.equal(api.events.length, beforeSecret, 'a bad secret must send nothing');
  console.log('Bad webhook secret rejected: OK\n');

  assert.match(await send('/start'), /Developer Work Companion/);
  assert.match(await send('/help'), /\/analyze/);
  assert.match(await send('/status'), /Developer Work Companion/);
  assert.match(await send('/summary'), /Developer Work Companion/);
  assert.match(await send('/projects'), /developer-work-companion/);
  assert.match(await send('/memory'), /Developer Work Companion/);
  assert.match(await send('/preferences'), /preferences/i);
  assert.match(await send('/project'), /Developer Work Companion/);

  // Missing-input path: no diff configured and none pasted.
  assert.match(await send('/analyze'), /missing a code diff/i);

  // Full analyze with pasted spec + diff (progress "🔄 …" then edited to result).
  assert.match(
    await send('/analyze spec: build the telegram interface diff: +added a line'),
    /Analysis ready/,
  );

  // On-demand generation reuses the session (no new input). Capture the message
  // ids so the reply-to-edit checks below can reply to each generated result.
  assert.match(await send('/daily'), /Daily Work Checkpoint/);
  const dailyId = requireArtifactId();
  assert.match(await send('/technical'), /Technical Change Brief/);
  const technicalId = requireArtifactId();
  assert.match(await send('/demo'), /Demo Prep/);
  const demoId = requireArtifactId();
  assert.match(await send('/weekly'), /Weekly Review/);

  // /latest re-shows the most recent artifact for free (no recompute).
  assert.match(await send('/latest'), /Weekly Review/);

  // Save the pending weekly update (still the most recent generated artifact).
  assert.match(await send('/save weekly'), /Saved progress/i);

  // Natural-language message routed to a command via the heuristic router.
  assert.match(await send('what is the status of my project?'), /Developer Work Companion/);
  assert.match(await send('give me a short summary'), /Developer Work Companion/);

  // Inline-button tap: callback data is a command line (regenerates daily).
  assert.match(await tap('/daily'), /Daily Work Checkpoint/);
  assert.ok(api.answered.length >= 1, 'a button tap must be acknowledged');

  // Reply-to-edit: reply to a generated result with a freeform instruction; the
  // registry resolves the (possibly split) artifact and the shared edit skill
  // revises it. Replies to any generated result work, even after other actions.
  assert.match(
    await replyEdit(dailyId, 'make it shorter'),
    /Edit applied to Daily Work Guidance/,
  );
  assert.match(
    await replyEdit(technicalId, 'translate to Hebrew'),
    /Edit applied to Technical Change Brief/,
  );
  assert.match(
    await replyEdit(demoId, 'make it more investor friendly'),
    /Edit applied to Demo Prep/,
  );
  // Replying to something we did not generate returns a friendly error.
  assert.match(await replyEdit(999999, 'make it shorter'), /can only edit results I generated/i);
  // After an edit, /latest reflects the edited version.
  assert.match(await send('/latest'), /Edit applied to Demo Prep/);

  // Clear requires confirmation, then clears.
  assert.match(await send('/clear'), /clear confirm/i);
  assert.match(await send('/clear confirm'), /Cleared project memory/i);

  // The bot token must NEVER appear in any outgoing message.
  for (const event of api.events) {
    assert.ok(!event.text.includes(FAKE_TOKEN), 'bot token leaked into a reply');
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
