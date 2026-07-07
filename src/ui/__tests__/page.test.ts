import { test } from 'node:test';
import assert from 'node:assert/strict';

import { renderPage } from '../page.js';

test('product header and subtitle render', () => {
  const html = renderPage({ mode: 'mock' });
  assert.match(html, /Code Change Understanding Agent/);
  assert.match(html, /turn the analysis into PR notes, flows, and team updates/i);
});

test('initial screen shows a single "Run Initial Analysis" primary button', () => {
  const html = renderPage({ mode: 'mock' });
  assert.match(html, /id="run-btn"/);
  assert.match(html, /Run Initial Analysis/);
  assert.doesNotMatch(html, />Run Analysis</);
});

test('no upfront include-flag checkboxes are exposed to the user', () => {
  const html = renderPage({ mode: 'mock' });
  for (const id of [
    'includeFlow',
    'includeGapReport',
    'includePrDescription',
    'includeVideoScript',
    'includeDailyUpdate',
  ]) {
    assert.doesNotMatch(html, new RegExp(`id="${id}"`), `${id} checkbox must not be in the UI`);
  }
});

test('master/detail workspace has a nav and exactly one content panel', () => {
  const html = renderPage({ mode: 'mock' });
  assert.match(html, /id="nav"/);
  const panelMatches = html.match(/id="panel"/g) ?? [];
  assert.equal(panelMatches.length, 1, 'there must be exactly one main panel');
  // Selecting items replaces the single panel's content.
  assert.match(html, /function selectItem/);
  assert.match(html, /function renderPanel/);
});

test('default selected panel is Overview', () => {
  const html = renderPage({ mode: 'mock' });
  assert.match(html, /selected: 'overview'/);
});

test('Raw JSON is not shown by default and lives behind a debug toggle', () => {
  const html = renderPage({ mode: 'mock' });
  assert.match(html, /id="debug-toggle"/);
  assert.match(html, /Show debug data/);
  // Raw JSON only enters the nav when the debug toggle is checked.
  assert.match(html, /debug-toggle'\)\.checked/);
});

test('initial analysis does NOT request optional outputs upfront', () => {
  const html = renderPage({ mode: 'mock' });
  // buildInitialPayload turns the optional outputs off.
  assert.match(html, /p\.includePrDescription = false/);
  assert.match(html, /p\.includeVideoScript = false/);
  assert.match(html, /p\.includeDailyUpdate = false/);
  assert.match(html, /p\.includeFlow = true; p\.includeGapReport = true/);
});

test('on-demand generation is wired (Generate buttons + session continuation)', () => {
  const html = renderPage({ mode: 'mock' });
  assert.match(html, /function generate\(/);
  assert.match(html, /'Generate ' \+ label/);
  assert.match(html, /sessionId: state\.sessionId/);
});

test('all four input modes remain available', () => {
  const html = renderPage({ mode: 'mock' });
  assert.match(html, /id="inputMode"/);
  for (const mode of ['manual', 'githubUrl', 'websiteContextUrl', 'notionText']) {
    assert.match(html, new RegExp(`value="${mode}"`), `missing option ${mode}`);
  }
  assert.match(html, /id="githubUrl"/);
  assert.match(html, /id="websiteUrl"/);
  assert.match(html, /id="notionText"/);
});

test('visual status labels are defined for all four states', () => {
  const html = renderPage({ mode: 'mock' });
  assert.match(html, /generated:'Generated'/);
  assert.match(html, /not_generated:'Not generated'/);
  assert.match(html, /generating:'Generating'/);
  assert.match(html, /error:'Error'/);
});

test('friendly product labels are present', () => {
  const html = renderPage({ mode: 'mock' });
  for (const label of [
    'What Changed',
    'Requirement Check',
    'PR Readiness',
    'Feature Flow',
    'PR Draft',
    'Walkthrough Script',
    'Daily Prep',
  ]) {
    assert.match(html, new RegExp(label), `missing label ${label}`);
  }
});

test('loading copy uses the friendly workspace-building messages', () => {
  const html = renderPage({ mode: 'mock' });
  assert.match(html, /Understanding the code change/);
  assert.match(html, /Checking it against the requirement/);
  assert.match(html, /Preparing your analysis workspace/);
});

test('mode copy is present and honest about limitations', () => {
  const html = renderPage({ mode: 'mock' });
  assert.match(html, /does not provide a code diff|requirement\/context only/i);
  assert.match(html, /Notion OAuth will come later/i);
});

test('status region and all four status states are wired', () => {
  const html = renderPage({ mode: 'mock' });
  assert.match(html, /id="status"/);
  assert.match(html, /status-idle/);
  assert.match(html, /status-loading/);
  assert.match(html, /status-success/);
  assert.match(html, /status-error/);
});

test('mock mode shows a clear demo/mock banner; real mode shows real banner', () => {
  assert.match(renderPage({ mode: 'mock' }), /DEMO \/ MOCK MODE/);
  assert.match(renderPage({ mode: 'mock' }), /NOT real AI/);
  assert.match(renderPage({ mode: 'real' }), /REAL ENGINE MODE/);
});

test('side chat panel container and render function exist', () => {
  const html = renderPage({ mode: 'mock' });
  assert.match(html, /id="chat"/);
  assert.match(html, /function renderChat/);
  assert.match(html, /Ask for edits to this artifact\. Changes will update the selected text\./);
});

test('chat title changes per editable artifact', () => {
  const html = renderPage({ mode: 'mock' });
  // EDITABLE maps each editable key to its product label, used in the title.
  assert.match(html, /prDescription:'PR Draft'/);
  assert.match(html, /videoScript:'Walkthrough Script'/);
  assert.match(html, /dailyUpdate:'Daily Prep'/);
  assert.match(html, /'Chat about ' \+ EDITABLE\[id\]/);
});

test('unsupported artifacts show an editing-unavailable message', () => {
  const html = renderPage({ mode: 'mock' });
  assert.match(html, /Chat editing is available for generated text artifacts only\./);
});

test('sending a chat message updates the selected artifact panel and copy text', () => {
  const html = renderPage({ mode: 'mock' });
  assert.match(html, /function sendChat/);
  // On success the card (with updated copyText) replaces the cached card.
  assert.match(html, /state\.cards\[id\] = data\.card/);
  assert.match(html, /if \(state\.selected === id\) renderPanel\(\)/);
});

test('chat edit calls the chat-edit endpoint, never a full re-analysis', () => {
  const html = renderPage({ mode: 'mock' });
  assert.match(html, /\/chat-edit/);
  // sendChat/undoChat must not call the analyze endpoint.
  assert.doesNotMatch(html, /function sendChat[\s\S]*?\/api\/analyze[\s\S]*?function undoChat/);
});

test('undo last edit button is wired when history exists', () => {
  const html = renderPage({ mode: 'mock' });
  assert.match(html, /Undo last edit/);
  assert.match(html, /function undoChat/);
  assert.match(html, /\/undo-artifact-edit/);
  assert.match(html, /state\.canUndo\[id\]/);
});
