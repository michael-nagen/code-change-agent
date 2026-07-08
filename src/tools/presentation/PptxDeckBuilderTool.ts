import { ToolError } from '../../errors/ToolError.js';
import { buildPptxDeck } from './pptxDeckBuilder.js';
import type { MarkdownDeckInput, PptxDeckBuilderTool, PptxDeckResult } from './types.js';

/**
 * Deterministic PPTX builder: turns a Demo Prep Loop deck plan into a real
 * .pptx file. No LLM involvement — the plan is rendered exactly as the skill
 * produced it.
 */
export class DefaultPptxDeckBuilderTool implements PptxDeckBuilderTool {
  readonly name = 'pptx-deck-builder';

  async execute(input: MarkdownDeckInput): Promise<PptxDeckResult> {
    if (input.deckPlan.length === 0) {
      throw new ToolError('VALIDATION', 'deckPlan must contain at least one slide.');
    }
    return {
      bytes: buildPptxDeck(input),
      slideCount: input.deckPlan.length,
    };
  }
}
