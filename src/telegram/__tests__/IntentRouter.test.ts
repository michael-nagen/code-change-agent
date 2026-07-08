import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DefaultIntentRouter } from '../IntentRouter.js';
import type {
  WorkRequestIntent,
  WorkRequestIntentSkill,
} from '../../skills/workRequestIntent/index.js';

class StubSkill implements WorkRequestIntentSkill {
  readonly name = 'stub';
  constructor(private readonly result: WorkRequestIntent | Error) {}
  async execute(): Promise<WorkRequestIntent> {
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
}

test('heuristic router maps common phrasings to commands (no skill)', async () => {
  const router = new DefaultIntentRouter();
  assert.deepEqual(await router.route('what is the status of checkout?'), {
    command: 'status',
    argsText: '',
  });
  assert.equal((await router.route('run the daily prep'))?.command, 'daily');
  assert.equal((await router.route('list all projects'))?.command, 'projects');
  assert.equal((await router.route('help'))?.command, 'help');
  assert.equal(await router.route('asdfqwer zzz'), undefined);
});

test('skill router reconstructs the analyze command line from extracted fields', async () => {
  const router = new DefaultIntentRouter(
    new StubSkill({ action: 'analyze', projectName: 'checkout', spec: 'add cache', diff: '+x' }),
  );
  assert.deepEqual(await router.route('please analyze my checkout work'), {
    command: 'analyze',
    argsText: 'checkout spec: add cache diff: +x',
  });
});

test('skill router maps a save intent with its source', async () => {
  const router = new DefaultIntentRouter(new StubSkill({ action: 'save', saveSource: 'weekly' }));
  assert.deepEqual(await router.route('save my weekly update'), {
    command: 'save',
    argsText: 'weekly',
  });
});

test('a skill returning unknown falls back to the heuristic', async () => {
  const router = new DefaultIntentRouter(new StubSkill({ action: 'unknown' }));
  assert.equal((await router.route('show me the blockers and status'))?.command, 'status');
});

test('a skill error falls back to the heuristic rather than throwing', async () => {
  const router = new DefaultIntentRouter(new StubSkill(new Error('model down')));
  assert.equal((await router.route('generate the weekly review'))?.command, 'weekly');
});

test('empty input routes to nothing', async () => {
  const router = new DefaultIntentRouter();
  assert.equal(await router.route('   '), undefined);
});
