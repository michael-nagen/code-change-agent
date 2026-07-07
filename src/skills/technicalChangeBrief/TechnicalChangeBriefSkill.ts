import type { LanguageModel } from '../../llm/LanguageModel.js';
import type { TechnicalChangeBrief, TechnicalChangeBriefInput } from './types.js';
import { buildPrompt } from './prompt.js';
import { parseOutput } from './parseOutput.js';

/**
 * Turns the raw diff, the requirement/spec, and the upstream analysis artifacts
 * into a structured Technical Change Brief: an implementation-focused
 * explanation of what changed, meant for a PR, demo, walkthrough, or technical
 * discussion.
 *
 * It is LLM-backed: it reasons over the diff plus the analysis artifacts,
 * separates confirmed implementation details from inferred impact, and fails
 * closed on invalid model output. It is NOT the PR description, and it does not
 * focus on reviewer questions.
 */
export interface TechnicalChangeBriefSkill {
  readonly name: string;
  execute(input: TechnicalChangeBriefInput): Promise<TechnicalChangeBrief>;
}

export class DefaultTechnicalChangeBriefSkill implements TechnicalChangeBriefSkill {
  readonly name = 'technical-change-brief';

  constructor(private readonly model: LanguageModel) {}

  async execute(input: TechnicalChangeBriefInput): Promise<TechnicalChangeBrief> {
    const prompt = buildPrompt(input);
    const { text } = await this.model.generate({ prompt });
    return parseOutput(text);
  }
}
