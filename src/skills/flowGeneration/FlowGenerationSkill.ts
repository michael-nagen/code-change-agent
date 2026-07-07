import type { LanguageModel } from '../../llm/LanguageModel.js';
import type { FlowArtifact, FlowGenerationInput } from './types.js';
import { buildPrompt } from './prompt.js';
import { parseOutput } from './parseOutput.js';

/**
 * Produces a reusable runtime/system flow from a ChangeExplanation.
 *
 * It is LLM-backed: it reasons over the ChangeExplanation only. Its input
 * deliberately excludes the raw diff, so it cannot re-analyze the change,
 * regenerate the ChangeExplanation, or invent integrations, tools, or UI the
 * explanation does not mention.
 */
export interface FlowGenerationSkill {
  readonly name: string;
  execute(input: FlowGenerationInput): Promise<FlowArtifact>;
}

export class DefaultFlowGenerationSkill implements FlowGenerationSkill {
  readonly name = 'flow-generation';

  constructor(private readonly model: LanguageModel) {}

  async execute(input: FlowGenerationInput): Promise<FlowArtifact> {
    const prompt = buildPrompt(input);
    const { text } = await this.model.generate({ prompt });
    return parseOutput(text);
  }
}
