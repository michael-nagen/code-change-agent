import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TelegramCommandService } from '../TelegramCommandService.js';
import { DefaultTelegramWorkflowBridge } from '../TelegramWorkflowBridge.js';
import { InMemoryTelegramStateStore } from '../TelegramStateStore.js';
import type { TelegramConfig } from '../types.js';
import { InMemoryMemoryStore } from '../../memory/index.js';
import type { MemoryStore } from '../../memory/index.js';
import { MockAnalysisRunner } from '../../ui/index.js';
import { NotionWriteBackService } from '../../notion/index.js';
import { MockNotionConnector } from '../../sources/index.js';

const CHAT = 1;
const CONFIG: TelegramConfig = { botToken: 'unit-token', allowedChatIds: ['1'], defaultProject: 'demo' };

/** Run a slash command line through the service and join the reply text. */
async function run(
  svc: TelegramCommandService,
  command: string,
  argsText = '',
  chatId: number | string = CHAT,
): Promise<string> {
  const line = argsText === '' ? `/${command}` : `/${command} ${argsText}`;
  const reply = await svc.handleMessage({ text: line, chatId });
  return reply.messages.map((m) => m.text).join('\n');
}

function makeService({
  connector,
  memoryStore = new InMemoryMemoryStore(),
  withWriteBack = true,
}: {
  connector?: MockNotionConnector;
  memoryStore?: MemoryStore;
  withWriteBack?: boolean;
} = {}): { svc: TelegramCommandService; connector: MockNotionConnector } {
  const notionConnector = connector ?? new MockNotionConnector();
  const notionWriteBack = new NotionWriteBackService({
    connector: notionConnector,
    defaultPageId: 'page-1',
  });
  const bridge = new DefaultTelegramWorkflowBridge({
    runner: new MockAnalysisRunner(),
    mode: 'mock',
    memoryStore,
    ...(withWriteBack ? { notionWriteBack } : {}),
  });
  const svc = new TelegramCommandService({
    memoryStore,
    config: CONFIG,
    userId: 'local',
    bridge,
    stateStore: new InMemoryTelegramStateStore(),
  });
  return { svc, connector: notionConnector };
}

test('/notion with no subcommand shows usage', async () => {
  const { svc } = makeService();
  const reply = await run(svc, 'notion', '');
  assert.match(reply, /Usage: \/notion daily \| weekly \| demo \| memory/);
});

test('/notion daily before generating returns a clear "no artifact" message', async () => {
  const { svc, connector } = makeService();
  const reply = await run(svc, 'notion', 'daily');
  assert.match(reply, /No daily artifact yet/i);
  assert.equal(connector.appended.length, 0);
});

test('/daily then /notion daily sends the artifact to Notion explicitly', async () => {
  const { svc, connector } = makeService();
  await run(svc, 'daily', 'spec: build it diff: +line');
  // Generation alone writes nothing to Notion.
  assert.equal(connector.appended.length, 0);

  const reply = await run(svc, 'notion', 'daily');
  assert.equal(reply, 'Sent to Notion.');
  assert.ok(connector.appended.length >= 1);
  assert.ok(connector.appended[0]!.content.includes('Daily Work Guidance'));
});

test('/send-notion is accepted as an alias', async () => {
  const { svc } = makeService();
  await run(svc, 'weekly', 'spec: build it diff: +line');
  const reply = await run(svc, 'send-notion', 'weekly');
  assert.equal(reply, 'Sent to Notion.');
});

test('/notion memory without saved memory returns a clear error', async () => {
  const { svc } = makeService();
  const reply = await run(svc, 'notion', 'memory');
  assert.match(reply, /No saved project memory/i);
});

test('/notion reports unavailable when write-back is not wired', async () => {
  const { svc, connector } = makeService({ withWriteBack: false });
  await run(svc, 'daily', 'spec: build it diff: +line');
  const reply = await run(svc, 'notion', 'daily');
  assert.match(reply, /not configured/i);
  assert.equal(connector.appended.length, 0);
});

test('/notion replies never contain the bot token', async () => {
  const { svc } = makeService();
  await run(svc, 'daily', 'spec: s diff: +d');
  const reply = await run(svc, 'notion', 'daily');
  assert.ok(!reply.includes(CONFIG.botToken));
});
