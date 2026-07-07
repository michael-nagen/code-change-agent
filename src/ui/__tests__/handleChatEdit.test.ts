import { test } from 'node:test';
import assert from 'node:assert/strict';

import { handleChatEdit, handleUndoArtifactEdit } from '../handleChatEdit.js';
import { UiSessionStore, getEditableArtifact } from '../sessionStore.js';
import type { AnalysisResult } from '../../analysis/index.js';
import type {
  ArtifactEditInput,
  ArtifactEditResult,
  ArtifactEditSkill,
} from '../../skills/artifactEdit/index.js';
import type { PRDescription } from '../../skills/prDescription/index.js';
import type { VideoScript } from '../../skills/videoScript/index.js';
import type { DailyUpdate } from '../../skills/dailyUpdate/index.js';

const PR: PRDescription = {
  title: 'Original PR',
  summary: 'Original summary.',
  whatChanged: ['Thing'],
  requirementCoverage: ['Satisfied: thing'],
  featureFlow: 'Flow.',
  testingNotes: ['Test it'],
  risksAndFollowUps: ['Risk'],
};

const VIDEO: VideoScript = {
  title: 'Original video',
  targetAudience: 'Devs',
  estimatedDuration: '~1 min',
  sections: [{ title: 'Intro', narration: 'Hi', visualCue: 'Show' }],
  keyTakeaways: ['Takeaway'],
};

const DAILY: DailyUpdate = {
  headline: 'Original headline.',
  yesterdaySummary: ['Did thing'],
  todaySuggestions: ['Do thing'],
  blockersOrRisks: ['Blocker'],
  highlightedTopic: { title: 'Topic', explanation: 'Why', whyItMatters: 'Matters' },
  spokenVersion: 'Original spoken.',
};

function seededResult(): AnalysisResult {
  return {
    sessionId: 's1',
    requirementInput: { requirementText: 'req', source: 'manual' },
    changeExplanation: {
      changeStory: 'story',
      keyFunctionalities: ['f'],
      flow: ['a'],
      mainComponents: [{ name: 'C', responsibility: 'r' }],
      architecturalDecisions: ['d'],
      impactAnalysis: ['i'],
      uncertainties: ['u'],
    },
    requirementAlignment: {
      requirementSummary: 'sum',
      satisfiedItems: ['s'],
      partiallySatisfiedItems: [],
      missingItems: [],
      unclearItems: [],
      overallAssessment: 'ok',
      confidence: 'high',
    },
    prDescription: PR,
    videoScript: VIDEO,
    dailyUpdate: DAILY,
  };
}

/** A stub edit skill that applies a caller-provided transform, recording calls. */
class StubEditSkill implements ArtifactEditSkill {
  readonly name = 'stub-edit';
  readonly calls: ArtifactEditInput[] = [];
  constructor(private readonly transform: (input: ArtifactEditInput) => ArtifactEditResult) {}
  async execute(input: ArtifactEditInput): Promise<ArtifactEditResult> {
    this.calls.push(input);
    return this.transform(input);
  }
}

function seededStore(): UiSessionStore {
  const store = new UiSessionStore();
  store.saveResult(seededResult());
  return store;
}

test('editing prDescription updates only prDescription', async () => {
  const store = seededStore();
  const skill = new StubEditSkill(() => ({
    assistantMessage: 'ok',
    changeSummary: 'shortened',
    updatedArtifact: { ...PR, summary: 'Shorter.' },
  }));

  const res = await handleChatEdit({ skill, store, sessionId: 's1', body: { artifactKey: 'prDescription', message: 'shorter' } });
  assert.equal(res.status, 'success');

  const result = store.getResult('s1');
  assert.equal(result?.prDescription?.summary, 'Shorter.');
  assert.deepEqual(result?.videoScript, VIDEO);
  assert.deepEqual(result?.dailyUpdate, DAILY);
});

test('editing dailyUpdate updates only dailyUpdate', async () => {
  const store = seededStore();
  const skill = new StubEditSkill(() => ({
    assistantMessage: 'ok',
    changeSummary: 'hebrew',
    updatedArtifact: { ...DAILY, headline: 'חדש.' },
  }));

  await handleChatEdit({ skill, store, sessionId: 's1', body: { artifactKey: 'dailyUpdate', message: 'hebrew' } });

  const result = store.getResult('s1');
  assert.equal(result?.dailyUpdate?.headline, 'חדש.');
  assert.deepEqual(result?.prDescription, PR);
  assert.deepEqual(result?.videoScript, VIDEO);
});

test('editing videoScript updates only videoScript', async () => {
  const store = seededStore();
  const skill = new StubEditSkill(() => ({
    assistantMessage: 'ok',
    changeSummary: 'tightened',
    updatedArtifact: { ...VIDEO, estimatedDuration: '~2 min' },
  }));

  await handleChatEdit({ skill, store, sessionId: 's1', body: { artifactKey: 'videoScript', message: '2 minute' } });

  const result = store.getResult('s1');
  assert.equal(result?.videoScript?.estimatedDuration, '~2 min');
  assert.deepEqual(result?.prDescription, PR);
  assert.deepEqual(result?.dailyUpdate, DAILY);
});

test('previous artifact version is stored before update (undo available)', async () => {
  const store = seededStore();
  const skill = new StubEditSkill(() => ({
    assistantMessage: 'ok',
    changeSummary: 'edit',
    updatedArtifact: { ...PR, summary: 'Edited.' },
  }));

  assert.equal(store.hasHistory('s1', 'prDescription'), false);
  const res = await handleChatEdit({ skill, store, sessionId: 's1', body: { artifactKey: 'prDescription', message: 'x' } });
  assert.equal(res.status, 'success');
  assert.equal(res.status === 'success' && res.canUndo, true);
  assert.equal(store.hasHistory('s1', 'prDescription'), true);
});

test('undo restores the previous artifact', async () => {
  const store = seededStore();
  const skill = new StubEditSkill(() => ({
    assistantMessage: 'ok',
    changeSummary: 'edit',
    updatedArtifact: { ...PR, summary: 'Edited.' },
  }));

  await handleChatEdit({ skill, store, sessionId: 's1', body: { artifactKey: 'prDescription', message: 'x' } });
  assert.equal(store.getResult('s1')?.prDescription?.summary, 'Edited.');

  const undo = handleUndoArtifactEdit({ store, sessionId: 's1', body: { artifactKey: 'prDescription' } });
  assert.equal(undo.status, 'success');
  assert.equal(undo.status === 'success' && undo.restored, true);
  assert.equal(store.getResult('s1')?.prDescription?.summary, 'Original summary.');
  assert.equal(store.hasHistory('s1', 'prDescription'), false);
});

test('undo only affects the selected artifact', async () => {
  const store = seededStore();
  const skill = new StubEditSkill((input) => {
    if (input.selectedArtifactKey === 'prDescription') {
      return { assistantMessage: 'ok', changeSummary: 'e', updatedArtifact: { ...PR, summary: 'PR edited.' } };
    }
    return { assistantMessage: 'ok', changeSummary: 'e', updatedArtifact: { ...VIDEO, title: 'Video edited.' } };
  });

  await handleChatEdit({ skill, store, sessionId: 's1', body: { artifactKey: 'prDescription', message: 'x' } });
  await handleChatEdit({ skill, store, sessionId: 's1', body: { artifactKey: 'videoScript', message: 'y' } });

  handleUndoArtifactEdit({ store, sessionId: 's1', body: { artifactKey: 'prDescription' } });

  const result = store.getResult('s1');
  assert.equal(result?.prDescription?.summary, 'Original summary.');
  // Video edit must be untouched by the prDescription undo.
  assert.equal(result?.videoScript?.title, 'Video edited.');
});

test('chat edit does not regenerate or touch unrelated artifacts; returns updated card', async () => {
  const store = seededStore();
  const skill = new StubEditSkill(() => ({
    assistantMessage: 'Shortened it.',
    changeSummary: 'shorter',
    updatedArtifact: { ...PR, summary: 'Crisp.' },
  }));

  const res = await handleChatEdit({ skill, store, sessionId: 's1', body: { artifactKey: 'prDescription', message: 'shorter' } });
  assert.equal(res.status, 'success');
  if (res.status !== 'success') return;
  // The returned card carries the updated copy text (Copy PR Draft uses it).
  assert.match(res.card.copyText ?? '', /Crisp\./);
  assert.equal(res.card.id, 'prDescription');
});

test('editing an unsupported / not-present artifact fails clearly', async () => {
  const store = new UiSessionStore();
  const withoutPr = seededResult();
  delete withoutPr.prDescription;
  store.saveResult(withoutPr);
  const skill = new StubEditSkill(() => {
    throw new Error('should not be called');
  });

  const res = await handleChatEdit({ skill, store, sessionId: 's1', body: { artifactKey: 'prDescription', message: 'x' } });
  assert.equal(res.status, 'error');
  assert.match(res.status === 'error' ? res.message : '', /generated text artifacts only/);
});

test('editing a non-editable key is rejected', async () => {
  const store = seededStore();
  const skill = new StubEditSkill(() => {
    throw new Error('should not be called');
  });

  const res = await handleChatEdit({ skill, store, sessionId: 's1', body: { artifactKey: 'gapReport', message: 'x' } });
  assert.equal(res.status, 'error');
  assert.equal(skill.calls.length, 0);
});

test('unknown session is reported, not thrown', async () => {
  const store = new UiSessionStore();
  const skill = new StubEditSkill(() => {
    throw new Error('should not be called');
  });

  const res = await handleChatEdit({ skill, store, sessionId: 'missing', body: { artifactKey: 'prDescription', message: 'x' } });
  assert.equal(res.status, 'error');
  assert.match(res.status === 'error' ? res.message : '', /Session not found/);
});

test('getEditableArtifact reads the right slot', () => {
  const result = seededResult();
  assert.deepEqual(getEditableArtifact(result, 'prDescription'), PR);
  assert.deepEqual(getEditableArtifact(result, 'videoScript'), VIDEO);
  assert.deepEqual(getEditableArtifact(result, 'dailyUpdate'), DAILY);
});
