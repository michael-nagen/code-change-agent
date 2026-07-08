import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TelegramCommandService } from '../TelegramCommandService.js';
import { DefaultTelegramWorkflowBridge } from '../TelegramWorkflowBridge.js';
import type {
  TelegramWorkflowBridge,
  TelegramGenerationRequest,
  TelegramGenerationResult,
} from '../TelegramWorkflowBridge.js';
import { InMemoryTelegramStateStore } from '../TelegramStateStore.js';
import type { TelegramConfig } from '../types.js';
import { InMemoryMemoryStore, MEMORY_SCHEMA_VERSION } from '../../memory/index.js';
import type { MemoryStore } from '../../memory/index.js';
import { MockAnalysisRunner } from '../../ui/index.js';
import type { SaveMemoryResponse, ClearMemoryResponse } from '../../ui/types.js';

const CHAT = 1;
const CONFIG: TelegramConfig = { botToken: 'unit-token', allowedChatIds: ['1'], defaultProject: 'demo' };

function realBridge(memoryStore: MemoryStore): DefaultTelegramWorkflowBridge {
  return new DefaultTelegramWorkflowBridge({
    runner: new MockAnalysisRunner(),
    mode: 'mock',
    memoryStore,
  });
}

function service({
  memoryStore = new InMemoryMemoryStore(),
  bridge,
}: {
  memoryStore?: MemoryStore;
  bridge?: TelegramWorkflowBridge;
} = {}): { svc: TelegramCommandService; memoryStore: MemoryStore } {
  const svc = new TelegramCommandService({
    memoryStore,
    config: CONFIG,
    userId: 'local',
    ...(bridge !== undefined ? { bridge } : {}),
    stateStore: new InMemoryTelegramStateStore(),
  });
  return { svc, memoryStore };
}

/** A spy bridge that records generate/save/clear calls and returns canned data. */
class SpyBridge implements TelegramWorkflowBridge {
  readonly generationAvailable = true;
  readonly mode = 'mock' as const;
  readonly generateCalls: TelegramGenerationRequest[] = [];
  readonly saveCalls: { source: string; sessionId: string; projectName?: string }[] = [];
  readonly clearCalls: { projectName?: string }[] = [];
  generateResult: TelegramGenerationResult = { status: 'error', message: 'stub' };

  async generate(request: TelegramGenerationRequest): Promise<TelegramGenerationResult> {
    this.generateCalls.push(request);
    return this.generateResult;
  }
  async saveMemory(input: {
    source: 'daily' | 'weekly';
    sessionId: string;
    projectName?: string;
  }): Promise<SaveMemoryResponse> {
    this.saveCalls.push(input);
    return { status: 'success', message: 'saved', savedDate: '2026-07-08', memory: { loadedForThisRun: false } };
  }
  async clearMemory(input: { projectName?: string }): Promise<ClearMemoryResponse> {
    this.clearCalls.push(input);
    return { status: 'success', memory: { loadedForThisRun: false } };
  }
}

test('project resolution falls back to the configured default for /status', async () => {
  const { svc } = service();
  const reply = await svc.run({ command: 'status', argsText: '', chatId: CHAT });
  assert.match(reply, /Project: demo/);
});

test('/project sets and reports the active project for the chat', async () => {
  const { svc } = service();
  const set = await svc.run({ command: 'project', argsText: 'My Other Project', chatId: CHAT });
  assert.match(set, /Active project set to: My Other Project/);
  const shown = await svc.run({ command: 'project', argsText: '', chatId: CHAT });
  assert.match(shown, /My Other Project/);
});

test('/daily, /technical, /demo, /weekly each call the workflow bridge with the right artifact', async () => {
  const bridge = new SpyBridge();
  const { svc } = service({ bridge });
  for (const artifact of ['daily', 'technical', 'demo', 'weekly'] as const) {
    await svc.run({ command: artifact, argsText: 'spec: s diff: +d', chatId: CHAT });
  }
  assert.deepEqual(
    bridge.generateCalls.map((c) => c.artifact),
    ['daily', 'technical', 'demo', 'weekly'],
  );
});

test('/analyze with no input and no configured sources returns a helpful missing-input error', async () => {
  const memoryStore = new InMemoryMemoryStore();
  const { svc } = service({ memoryStore, bridge: realBridge(memoryStore) });
  const reply = await svc.run({ command: 'analyze', argsText: '', chatId: CHAT });
  assert.match(reply, /code diff/i);
  assert.match(reply, /\/analyze spec:/);
});

test('generation commands report unavailability when no bridge is wired', async () => {
  const { svc } = service();
  const reply = await svc.run({ command: 'daily', argsText: '', chatId: CHAT });
  assert.match(reply, /not configured/i);
});

test('/analyze then /daily generates a Daily Work Guidance via the real workflow (mock engine)', async () => {
  const memoryStore = new InMemoryMemoryStore();
  const { svc } = service({ memoryStore, bridge: realBridge(memoryStore) });
  const analyze = await svc.run({
    command: 'analyze',
    argsText: 'spec: build it diff: +line',
    chatId: CHAT,
  });
  assert.match(analyze, /Analysis ready/);
  const daily = await svc.run({ command: 'daily', argsText: '', chatId: CHAT });
  assert.match(daily, /Daily Work Guidance/);
  assert.match(daily, /\/save daily/);
});

test('/save requires a pending memory update', async () => {
  const memoryStore = new InMemoryMemoryStore();
  const { svc } = service({ memoryStore, bridge: realBridge(memoryStore) });
  const reply = await svc.run({ command: 'save', argsText: '', chatId: CHAT });
  assert.match(reply, /No pending memory update/i);
});

test('/save persists the pending daily update to project memory', async () => {
  const memoryStore = new InMemoryMemoryStore();
  const { svc } = service({ memoryStore, bridge: realBridge(memoryStore) });
  await svc.run({ command: 'daily', argsText: 'spec: build it diff: +line', chatId: CHAT });
  const saved = await svc.run({ command: 'save', argsText: '', chatId: CHAT });
  assert.match(saved, /Saved progress/i);
  const memory = await memoryStore.getProjectMemory({ userId: 'local', projectId: 'demo' });
  assert.notEqual(memory?.latestSnapshot, undefined);
});

test('/clear requires confirmation before clearing', async () => {
  const bridge = new SpyBridge();
  const { svc } = service({ bridge });
  const first = await svc.run({ command: 'clear', argsText: '', chatId: CHAT });
  assert.match(first, /clear confirm/i);
  assert.equal(bridge.clearCalls.length, 0);
});

test('/clear confirm clears ONLY project memory, leaving user preferences intact', async () => {
  const memoryStore = new InMemoryMemoryStore();
  await memoryStore.saveUserMemory({
    userId: 'local',
    memory: {
      schemaVersion: MEMORY_SCHEMA_VERSION,
      userId: 'local',
      preferences: ['keep me'],
      promptPreferences: { cursor: ['small diffs'] },
      updatedAt: new Date().toISOString(),
    },
  });
  await memoryStore.saveProjectMemory({
    userId: 'local',
    projectId: 'demo',
    memory: {
      schemaVersion: MEMORY_SCHEMA_VERSION,
      userId: 'local',
      projectId: 'demo',
      latestSnapshot: {
        date: '2026-07-07',
        dailySummary: 'progress',
        updatedChecklistStatuses: [],
        openBlockers: [],
        openDecisions: [],
        nextActions: [],
      },
      history: [],
      updatedAt: new Date().toISOString(),
    },
  });

  const { svc } = service({ memoryStore, bridge: realBridge(memoryStore) });
  await svc.run({ command: 'clear', argsText: '', chatId: CHAT });
  const done = await svc.run({ command: 'clear', argsText: 'confirm', chatId: CHAT });
  assert.match(done, /Cleared project memory/i);

  assert.equal(await memoryStore.getProjectMemory({ userId: 'local', projectId: 'demo' }), undefined);
  const userMemory = await memoryStore.getUserMemory({ userId: 'local' });
  assert.deepEqual(userMemory?.promptPreferences, { cursor: ['small diffs'] });
});

test('no reply ever contains the bot token', async () => {
  const memoryStore = new InMemoryMemoryStore();
  const { svc } = service({ memoryStore, bridge: realBridge(memoryStore) });
  const replies = [
    await svc.run({ command: 'start', argsText: '', chatId: CHAT }),
    await svc.run({ command: 'help', argsText: '', chatId: CHAT }),
    await svc.run({ command: 'status', argsText: '', chatId: CHAT }),
    await svc.run({ command: 'analyze', argsText: 'spec: s diff: +d', chatId: CHAT }),
  ];
  for (const reply of replies) {
    assert.ok(!reply.includes(CONFIG.botToken));
  }
});
