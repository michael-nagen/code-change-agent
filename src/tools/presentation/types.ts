/**
 * Types for the presentation deck builder tool.
 *
 * The tool converts an already-generated Demo Prep Loop deck plan into a
 * Markdown presentation document. It performs deterministic formatting only —
 * no LLM, no reasoning, no interpretation, no judgement about what belongs on
 * a slide. The LLM skill decides the content; this tool only renders it.
 */
import type { DeckSlide, ScreenshotPlanItem } from '../../skills/demoPrepLoop/index.js';

/** Optional document-level metadata for the deck title block. */
export interface DeckMetadata {
  title?: string;
  date?: string;
  projectName?: string;
}

/** Shared input for both deck builders (Markdown and PPTX). */
export interface MarkdownDeckInput {
  /** The structured deck plan from the demoPrepLoop artifact. */
  deckPlan: readonly DeckSlide[];
  /** Used to resolve screenshotIds into titled placeholders with captions. */
  screenshotPlan?: readonly ScreenshotPlanItem[];
  metadata?: DeckMetadata;
}

export interface MarkdownDeckResult {
  markdown: string;
  slideCount: number;
}

export interface PptxDeckResult {
  /** The .pptx file bytes (a ZIP of OOXML parts). */
  bytes: Uint8Array;
  slideCount: number;
}

/**
 * Builds a Markdown deck from a deck plan. Implementations must not reason
 * about, reorder, summarize, or rewrite the slides — formatting only.
 */
export interface PresentationDeckBuilderTool {
  readonly name: string;
  execute(input: MarkdownDeckInput): Promise<MarkdownDeckResult>;
}

/**
 * Builds a .pptx deck from a deck plan. Same rule as the Markdown builder:
 * deterministic formatting only, no LLM, no reasoning.
 */
export interface PptxDeckBuilderTool {
  readonly name: string;
  execute(input: MarkdownDeckInput): Promise<PptxDeckResult>;
}
