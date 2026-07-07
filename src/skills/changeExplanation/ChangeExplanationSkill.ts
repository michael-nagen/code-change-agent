import type { LanguageModel } from './LanguageModel.js';
import type { ChangeExplanation, ChangeExplanationInput } from './types.js';
import { buildPrompt } from './prompt.js';
import { parseOutput } from './parseOutput.js';

/**
 * A real implementation delegates to a LanguageModel; a mock can be injected
 * for development and testing.
 *
 * Explicit non-goals: this skill does NOT read git repositories, generate
 * reports, evaluate requirement alignment, perform git operations, or produce
 * any communication artifacts.
 */
export interface ChangeExplanationSkill {
  readonly name: string;
  execute(input: ChangeExplanationInput): Promise<ChangeExplanation>;
}

/**
 * Swap the model for a MockLanguageModel in development/tests, or a real LLM
 * adapter (OpenAI, Anthropic, ...) in production — the skill's interface stays
 * the same.
 */
export class DefaultChangeExplanationSkill implements ChangeExplanationSkill {
  readonly name = 'change-explanation';

  constructor(private readonly model: LanguageModel) {}

  async execute(input: ChangeExplanationInput): Promise<ChangeExplanation> {
    const prompt = buildPrompt(input);
    const { text } = await this.model.generate({ prompt });
    return parseOutput(text);
  }
}
