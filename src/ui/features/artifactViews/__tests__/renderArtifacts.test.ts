import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { AnalysisResult } from '../../../../analysis/index.js';
import type { WorkspaceCard } from '../../../types.js';
import { renderWorkspaceCards, prDescriptionToMarkdown } from '../index.js';

function baseResult(): AnalysisResult {
  return {
    sessionId: 'sess-1',
    requirementInput: { requirementText: 'Add a cache', source: 'manual' },
    changeExplanation: {
      changeStory: 'Adds a cache.',
      keyFunctionalities: ['Cache reads'],
      flow: ['read', 'store'],
      mainComponents: [{ name: 'Cache', responsibility: 'Holds values' }],
      architecturalDecisions: ['In-memory map'],
      impactAnalysis: ['Read path'],
      uncertainties: ['Tests?'],
    },
    requirementAlignment: {
      requirementSummary: 'Cache with TTL',
      satisfiedItems: ['TTL present'],
      partiallySatisfiedItems: [],
      missingItems: [],
      unclearItems: [],
      overallAssessment: 'Mostly aligned.',
      confidence: 'medium',
    },
  };
}

function fullResult(): AnalysisResult {
  const r = baseResult();
  r.gapReport = {
    readiness: 'needs_changes',
    completedWork: ['Did X'],
    remainingGaps: ['Missing Y'],
    partialItems: ['Half Z'],
    unclearItems: ['Unknown W'],
    risks: ['Risk R'],
    recommendedNextActions: ['Do Q'],
    prRecommendation: 'Hold the PR.',
  };
  r.flowArtifact = {
    title: 'My Flow',
    description: 'desc',
    steps: ['step one'],
    mermaid: 'flowchart TD\n  A --> B',
  };
  r.prDescription = {
    title: 'Add cache',
    summary: 'Summary here',
    whatChanged: ['Added cache'],
    requirementCoverage: ['TTL covered'],
    featureFlow: 'flow prose',
    testingNotes: ['Add unit tests'],
    risksAndFollowUps: ['Watch memory'],
  };
  r.videoScript = {
    title: 'Walkthrough',
    targetAudience: 'Devs',
    estimatedDuration: '~2 min',
    sections: [{ title: 'Intro', narration: 'hello', visualCue: 'show diff' }],
    keyTakeaways: ['Takeaway'],
  };
  r.dailyUpdate = {
    headline: 'Built the cache.',
    yesterdaySummary: ['Implemented cache'],
    todaySuggestions: ['Add tests'],
    blockersOrRisks: ['Memory'],
    highlightedTopic: { title: 'TTL', explanation: 'expires', whyItMatters: 'freshness' },
    spokenVersion: 'Yesterday I built the cache.',
  };
  return r;
}

function byId(cards: WorkspaceCard[], id: string): WorkspaceCard {
  const card = cards.find((c) => c.id === id);
  assert.ok(card, `expected card ${id}`);
  return card;
}

test('workspace exposes understanding, actions, and debug cards with friendly labels', () => {
  const cards = renderWorkspaceCards(fullResult());
  assert.equal(byId(cards, 'changeExplanation').label, 'What Changed');
  assert.equal(byId(cards, 'requirementAlignment').label, 'Requirement Check');
  assert.equal(byId(cards, 'gapReport').label, 'PR Readiness');
  assert.equal(byId(cards, 'flowArtifact').label, 'Feature Flow');
  assert.equal(byId(cards, 'prDescription').label, 'PR Draft');
  assert.equal(byId(cards, 'videoScript').label, 'Walkthrough Script');
  assert.equal(byId(cards, 'dailyUpdate').label, 'Daily Prep');

  assert.equal(byId(cards, 'changeExplanation').group, 'understanding');
  assert.equal(byId(cards, 'prDescription').group, 'actions');
  assert.equal(byId(cards, 'rawJson').group, 'debug');
});

test('present artifacts are marked generated and render content', () => {
  const cards = renderWorkspaceCards(fullResult());
  assert.equal(byId(cards, 'changeExplanation').state, 'generated');
  assert.match(byId(cards, 'changeExplanation').html, /Adds a cache\./);
  assert.equal(byId(cards, 'gapReport').state, 'generated');
  assert.match(byId(cards, 'gapReport').html, /needs_changes/);
  assert.match(byId(cards, 'gapReport').html, /Hold the PR\./);
});

test('absent optional artifacts show a friendly not-generated state (never an error)', () => {
  const cards = renderWorkspaceCards(baseResult());
  for (const id of ['gapReport', 'flowArtifact', 'prDescription', 'videoScript', 'dailyUpdate']) {
    const card = byId(cards, id);
    assert.equal(card.state, 'not_generated', `${id} should be not_generated`);
    assert.match(card.html, /hasn't been generated yet/);
    assert.doesNotMatch(card.html, /error|unexpected/i);
  }
  // Required artifacts are always generated.
  assert.equal(byId(cards, 'changeExplanation').state, 'generated');
  assert.equal(byId(cards, 'requirementAlignment').state, 'generated');
});

test('PR Draft card carries copyable markdown text (and only it)', () => {
  const cards = renderWorkspaceCards(fullResult());
  const pr = byId(cards, 'prDescription');
  assert.ok(pr.copyText, 'PR Draft should have copyText');
  assert.match(pr.copyText, /^# Add cache/);
  assert.match(pr.copyText, /## Testing notes/);

  // No other card offers copy.
  for (const id of ['changeExplanation', 'gapReport', 'videoScript', 'dailyUpdate', 'rawJson']) {
    assert.equal(byId(cards, id).copyText, undefined, `${id} must not have copyText`);
  }
});

test('Feature Flow shows steps and Mermaid as code (no rendering library)', () => {
  const cards = renderWorkspaceCards(fullResult());
  const flow = byId(cards, 'flowArtifact');
  assert.match(flow.html, /step one/);
  assert.match(flow.html, /flowchart TD/);
  assert.match(flow.html, /<pre/);
});

test('Raw JSON card always present and contains the serialized result', () => {
  const cards = renderWorkspaceCards(baseResult());
  const raw = byId(cards, 'rawJson');
  assert.equal(raw.state, 'generated');
  assert.match(raw.html, /sess-1/);
});

test('html is escaped to avoid injection', () => {
  const r = baseResult();
  r.changeExplanation.changeStory = '<script>alert(1)</script>';
  const cards = renderWorkspaceCards(r);
  const html = byId(cards, 'changeExplanation').html;
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});

test('prDescriptionToMarkdown produces a clean document', () => {
  const md = prDescriptionToMarkdown(fullResult().prDescription!);
  assert.match(md, /^# Add cache/);
  assert.match(md, /## What changed/);
  assert.match(md, /## Risks and follow-ups/);
});
