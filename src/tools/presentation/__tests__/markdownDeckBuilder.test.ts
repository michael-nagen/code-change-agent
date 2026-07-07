import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildMarkdownDeck } from '../markdownDeckBuilder.js';
import { DefaultPresentationDeckBuilderTool } from '../PresentationDeckBuilderTool.js';
import { ToolError } from '../../../errors/ToolError.js';
import type { DeckSlide, ScreenshotPlanItem } from '../../../skills/demoPrepLoop/index.js';

const SHOT: ScreenshotPlanItem = {
  id: 'shot-1',
  title: 'CacheEntry interface',
  type: 'code',
  filePath: 'src/cache.ts',
  whatToCapture: 'The CacheEntry interface with the expiresAt field.',
  whyThisMatters: 'It is the core data contract.',
  whatToSay: 'This is the shape every cached value takes.',
  whatToSkip: 'Imports above the interface.',
  relatedFeatureOrConcept: 'TTL cache',
  estimatedTimeSeconds: 30,
  mustShow: true,
  suggestedCaption: 'The new CacheEntry shape with TTL',
  evidence: 'confirmed',
  status: 'pending_approval',
};

const SLIDE_BULLETS: DeckSlide = {
  slideNumber: 1,
  title: 'The problem',
  purpose: 'Set up why the change was needed.',
  visualType: 'bullets',
  whatToShow: 'Three short pain points.',
  onSlideText: ['Reads were slow', 'Data went stale'],
  speakerNotes: 'Explain the incident that motivated the work.',
  narrationScript: 'Last sprint we noticed reads were slow.',
  transitionToNextSlide: 'So we built a cache.',
  estimatedTimeSeconds: 30,
  mustHave: true,
  status: 'draft',
};

const SLIDE_SCREENSHOT: DeckSlide = {
  slideNumber: 2,
  title: 'The cache entry model',
  purpose: 'Prove the schema change is real.',
  visualType: 'code_screenshot',
  screenshotIds: ['shot-1'],
  whatToShow: 'The CacheEntry interface screenshot.',
  onSlideText: ['One new type', 'TTL built in'],
  speakerNotes: 'Walk through each field.',
  narrationScript: 'This is the CacheEntry shape.',
  transitionToNextSlide: 'Now the read path.',
  estimatedTimeSeconds: 45,
  mustHave: false,
  status: 'draft',
};

test('builds one slide section per slide, separated by ---', () => {
  const markdown = buildMarkdownDeck({
    deckPlan: [SLIDE_BULLETS, SLIDE_SCREENSHOT],
    screenshotPlan: [SHOT],
  });

  assert.match(markdown, /## Slide 1 — The problem/);
  assert.match(markdown, /## Slide 2 — The cache entry model/);
  assert.equal(markdown.split('\n---\n').length, 3);
});

test('includes the metadata title block and falls back to Demo Presentation', () => {
  const withMeta = buildMarkdownDeck({
    deckPlan: [SLIDE_BULLETS],
    metadata: { title: 'Cache TTL Feature', projectName: 'my-project', date: '2026-07-07' },
  });
  assert.match(withMeta, /^# Demo Deck — Cache TTL Feature/);
  assert.match(withMeta, /_Project: my-project · Date: 2026-07-07_/);

  const withoutMeta = buildMarkdownDeck({ deckPlan: [SLIDE_BULLETS] });
  assert.match(withoutMeta, /^# Demo Deck — Demo Presentation/);
  assert.equal(withoutMeta.includes('_Project:'), false);
});

test('separates on-slide text, speaker notes, and narration script into labeled blocks', () => {
  const markdown = buildMarkdownDeck({ deckPlan: [SLIDE_BULLETS] });

  assert.match(markdown, /\*\*On slide:\*\*\n- Reads were slow\n- Data went stale/);
  assert.match(markdown, /\*\*Speaker notes:\*\*\nExplain the incident/);
  assert.match(markdown, /\*\*Narration script:\*\*\nLast sprint we noticed/);
});

test('resolves screenshot ids into placeholders with title, capture, and caption', () => {
  const markdown = buildMarkdownDeck({
    deckPlan: [SLIDE_SCREENSHOT],
    screenshotPlan: [SHOT],
  });

  assert.match(markdown, /> \[Screenshot placeholder: shot-1 — "CacheEntry interface"\]/);
  assert.match(markdown, /> Capture: The CacheEntry interface with the expiresAt field\./);
  assert.match(markdown, /> Caption: The new CacheEntry shape with TTL/);
});

test('renders a not-found placeholder for an unknown screenshot id without throwing', () => {
  const markdown = buildMarkdownDeck({
    deckPlan: [{ ...SLIDE_SCREENSHOT, screenshotIds: ['shot-99'] }],
    screenshotPlan: [SHOT],
  });

  assert.match(markdown, /> \[Screenshot placeholder: shot-99 — not found in the screenshot plan\]/);
});

test('slides with no screenshot get a generic visual placeholder', () => {
  const markdown = buildMarkdownDeck({ deckPlan: [SLIDE_BULLETS] });

  assert.match(markdown, /> \[Visual placeholder: bullets — Three short pain points\.\]/);
});

test('is deterministic and marks must-have slides in the footer', () => {
  const input = { deckPlan: [SLIDE_BULLETS, SLIDE_SCREENSHOT], screenshotPlan: [SHOT] };

  assert.equal(buildMarkdownDeck(input), buildMarkdownDeck(input));
  const markdown = buildMarkdownDeck(input);
  assert.match(markdown, /_Transition: So we built a cache\. · ~30s · must-have_/);
  assert.match(markdown, /_Transition: Now the read path\. · ~45s_/);
});

test('handles empty on-slide text without crashing', () => {
  const markdown = buildMarkdownDeck({ deckPlan: [{ ...SLIDE_BULLETS, onSlideText: [] }] });

  assert.match(markdown, /\*\*On slide:\*\*\n- \(no on-slide text\)/);
});

test('an empty deck plan renders a friendly notice from the pure builder', () => {
  const markdown = buildMarkdownDeck({ deckPlan: [] });

  assert.match(markdown, /^# Demo Deck — Demo Presentation/);
  assert.match(markdown, /_No slides in the deck plan yet\._/);
});

test('the tool wrapper rejects an empty deck plan with a ToolError', async () => {
  const tool = new DefaultPresentationDeckBuilderTool();

  await assert.rejects(
    () => tool.execute({ deckPlan: [] }),
    (err: unknown) => err instanceof ToolError && err.code === 'VALIDATION',
  );
});

test('the tool wrapper returns the markdown and slide count', async () => {
  const tool = new DefaultPresentationDeckBuilderTool();

  const result = await tool.execute({ deckPlan: [SLIDE_BULLETS, SLIDE_SCREENSHOT] });

  assert.equal(tool.name, 'presentation-deck-builder');
  assert.equal(result.slideCount, 2);
  assert.match(result.markdown, /## Slide 1 — The problem/);
});
