import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildPptxDeck } from '../pptxDeckBuilder.js';
import { DefaultPptxDeckBuilderTool } from '../PptxDeckBuilderTool.js';
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

/**
 * Entries are stored uncompressed, so entry names and XML content are directly
 * searchable in the raw archive bytes. UTF-8 decoding keeps multi-byte text
 * (em-dashes, bullets) searchable; ASCII markers like the ZIP signatures are
 * never swallowed by it.
 */
function asText(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('utf8');
}

test('produces a ZIP archive (PK signature and end-of-central-directory record)', () => {
  const bytes = buildPptxDeck({ deckPlan: [SLIDE_BULLETS] });

  assert.equal(bytes[0], 0x50); // P
  assert.equal(bytes[1], 0x4b); // K
  assert.equal(bytes[2], 0x03);
  assert.equal(bytes[3], 0x04);
  assert.ok(asText(bytes).includes('PK\x05\x06'), 'missing end-of-central-directory record');
});

test('creates one slide part and one notes part per deck slide', () => {
  const text = asText(buildPptxDeck({ deckPlan: [SLIDE_BULLETS, SLIDE_SCREENSHOT] }));

  for (const part of [
    '[Content_Types].xml',
    'ppt/presentation.xml',
    'ppt/slides/slide1.xml',
    'ppt/slides/slide2.xml',
    'ppt/notesSlides/notesSlide1.xml',
    'ppt/notesSlides/notesSlide2.xml',
    'ppt/slideMasters/slideMaster1.xml',
    'ppt/slideLayouts/slideLayout1.xml',
    'ppt/notesMasters/notesMaster1.xml',
    'ppt/theme/theme1.xml',
  ]) {
    assert.ok(text.includes(part), `missing part ${part}`);
  }
  assert.equal(text.includes('ppt/slides/slide3.xml'), false);
});

test('slides carry the title and the short on-slide bullets', () => {
  const text = asText(buildPptxDeck({ deckPlan: [SLIDE_BULLETS] }));

  assert.ok(text.includes('<a:t>Slide 1 — The problem</a:t>'));
  assert.ok(text.includes('<a:t>Reads were slow</a:t>'));
  assert.ok(text.includes('<a:t>Data went stale</a:t>'));
  assert.ok(text.includes('<a:buChar char="•"/>'));
});

test('resolves screenshot ids into visual placeholders with capture and caption', () => {
  const text = asText(buildPptxDeck({ deckPlan: [SLIDE_SCREENSHOT], screenshotPlan: [SHOT] }));

  assert.ok(text.includes('[Screenshot placeholder: shot-1 — &quot;CacheEntry interface&quot;]'));
  assert.ok(text.includes('Capture: The CacheEntry interface with the expiresAt field.'));
  assert.ok(text.includes('Caption: The new CacheEntry shape with TTL'));
});

test('slides with no screenshot get a generic visual placeholder', () => {
  const text = asText(buildPptxDeck({ deckPlan: [SLIDE_BULLETS] }));

  assert.ok(text.includes('[Visual placeholder: bullets — Three short pain points.]'));
});

test('an unknown screenshot id renders a not-found placeholder without throwing', () => {
  const text = asText(
    buildPptxDeck({
      deckPlan: [{ ...SLIDE_SCREENSHOT, screenshotIds: ['shot-99'] }],
      screenshotPlan: [SHOT],
    }),
  );

  assert.ok(text.includes('[Screenshot placeholder: shot-99 — not found in the screenshot plan]'));
});

test('speaker notes land in the notes slide', () => {
  const text = asText(buildPptxDeck({ deckPlan: [SLIDE_BULLETS] }));

  assert.ok(text.includes('<a:t>Explain the incident that motivated the work.</a:t>'));
  assert.ok(text.includes('<p:ph type="body" idx="1"/>'));
});

test('escapes XML special characters in slide text', () => {
  const text = asText(
    buildPptxDeck({
      deckPlan: [{ ...SLIDE_BULLETS, title: 'Fast & <safe>', onSlideText: ['a < b & c > d'] }],
    }),
  );

  assert.ok(text.includes('Fast &amp; &lt;safe&gt;'));
  assert.ok(text.includes('a &lt; b &amp; c &gt; d'));
  assert.equal(text.includes('<a:t>Fast & <safe></a:t>'), false);
});

test('handles empty on-slide text and empty speaker notes without crashing', () => {
  const text = asText(
    buildPptxDeck({ deckPlan: [{ ...SLIDE_BULLETS, onSlideText: [], speakerNotes: ' ' }] }),
  );

  assert.ok(text.includes('<a:t>(no on-slide text)</a:t>'));
  assert.ok(text.includes('<a:t>(no speaker notes)</a:t>'));
});

test('is deterministic (same input yields byte-identical archives)', () => {
  const input = { deckPlan: [SLIDE_BULLETS, SLIDE_SCREENSHOT], screenshotPlan: [SHOT] };

  assert.deepEqual(buildPptxDeck(input), buildPptxDeck(input));
});

test('an empty deck plan yields a friendly single-slide deck from the pure builder', () => {
  const text = asText(buildPptxDeck({ deckPlan: [] }));

  assert.ok(text.includes('ppt/slides/slide1.xml'));
  assert.ok(text.includes('No slides in the deck plan yet'));
  assert.equal(text.includes('ppt/slides/slide2.xml'), false);
});

test('the tool wrapper rejects an empty deck plan with a ToolError', async () => {
  const tool = new DefaultPptxDeckBuilderTool();

  await assert.rejects(
    () => tool.execute({ deckPlan: [] }),
    (err: unknown) => err instanceof ToolError && err.code === 'VALIDATION',
  );
});

test('the tool wrapper returns the bytes and slide count', async () => {
  const tool = new DefaultPptxDeckBuilderTool();

  const result = await tool.execute({ deckPlan: [SLIDE_BULLETS, SLIDE_SCREENSHOT] });

  assert.equal(tool.name, 'pptx-deck-builder');
  assert.equal(result.slideCount, 2);
  assert.equal(result.bytes[0], 0x50);
  assert.equal(result.bytes[1], 0x4b);
});
