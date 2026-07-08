import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DefaultTelegramWorkflowBridge } from '../TelegramWorkflowBridge.js';
import { MockArtifactTextEditSkill } from '../../skills/mocks/index.js';
import { InMemoryMemoryStore } from '../../memory/index.js';
import { MockAnalysisRunner } from '../../ui/index.js';

function bridge(withSkill: boolean): DefaultTelegramWorkflowBridge {
  return new DefaultTelegramWorkflowBridge({
    runner: new MockAnalysisRunner(),
    mode: 'mock',
    memoryStore: new InMemoryMemoryStore(),
    ...(withSkill ? { artifactTextEditSkill: new MockArtifactTextEditSkill() } : {}),
  });
}

test('editArtifactText delegates to the injected skill and returns the revised text', async () => {
  const result = await bridge(true).editArtifactText({
    artifact: 'daily',
    originalText: 'Daily body.',
    instruction: 'make it shorter',
    projectName: 'demo',
  });
  assert.equal(result.status, 'success');
  if (result.status === 'success') {
    assert.match(result.text, /Edit applied to Daily Work Guidance: "make it shorter"/);
  }
});

test('editArtifactText reports unavailable when no edit skill is configured', async () => {
  const result = await bridge(false).editArtifactText({
    artifact: 'daily',
    originalText: 'Daily body.',
    instruction: 'make it shorter',
  });
  assert.equal(result.status, 'error');
  if (result.status === 'error') {
    assert.match(result.message, /not configured/i);
  }
});
