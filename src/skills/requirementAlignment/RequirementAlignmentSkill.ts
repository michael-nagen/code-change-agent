import type { LanguageModel } from '../../llm/LanguageModel.js';
import type { RequirementAlignment, RequirementAlignmentInput } from './types.js';
import { buildPrompt } from './prompt.js';
import { parseOutput } from './parseOutput.js';

/**
 * Explicit non-goals: this skill does NOT read git repositories, generate
 * reports, evaluate code quality, perform git operations, or produce any
 * communication artifacts. Its only responsibility is to evaluate how well
 * the implemented change aligns with the original requirement.
 */
export interface RequirementAlignmentSkill {
  readonly name: string;
  execute(input: RequirementAlignmentInput): Promise<RequirementAlignment>;
}

export class DefaultRequirementAlignmentSkill implements RequirementAlignmentSkill {
  readonly name = 'requirement-alignment';

  constructor(private readonly model: LanguageModel) {}

  async execute(input: RequirementAlignmentInput): Promise<RequirementAlignment> {
    const prompt = buildPrompt(input);
    const { text } = await this.model.generate({ prompt });
    return parseOutput(text);
  }
}
