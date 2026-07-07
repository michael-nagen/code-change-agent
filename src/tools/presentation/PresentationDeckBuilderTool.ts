import { ToolError } from '../../errors/ToolError.js';
import { buildMarkdownDeck } from './markdownDeckBuilder.js';
import type { MarkdownDeckInput, MarkdownDeckResult, PresentationDeckBuilderTool } from './types.js';

/**
 * Deterministic presentation builder: turns a Demo Prep Loop deck plan into a
 * Markdown deck document. No LLM involvement — the plan is rendered exactly as
 * the skill produced it.
 */
export class DefaultPresentationDeckBuilderTool implements PresentationDeckBuilderTool {
  readonly name = 'presentation-deck-builder';

  async execute(input: MarkdownDeckInput): Promise<MarkdownDeckResult> {
    if (input.deckPlan.length === 0) {
      throw new ToolError('VALIDATION', 'deckPlan must contain at least one slide.');
    }
    return {
      markdown: buildMarkdownDeck(input),
      slideCount: input.deckPlan.length,
    };
  }
}
