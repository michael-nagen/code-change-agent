import type { LanguageModel } from '../../llm/LanguageModel.js';
import type { GuidanceCritiqueInput, GuidancePlanCritique } from './types.js';
import { buildPrompt } from './prompt.js';
import { parseOutput } from './parseOutput.js';

/**
 * Critiques a freshly generated Daily Work Guidance plan against the run's
 * own evidence — the bounded self-critique half of plan generation.
 *
 * It is LLM-backed but has no authority: it can flag issues and propose one
 * revision of the planning sections, all returned pending approval (the
 * parser rejects anything else). It runs exactly once per generation — the
 * orchestrator never loops it — and a failure leaves the original plan
 * untouched. It never re-runs the base code analysis.
 */
export interface GuidanceCritiqueSkill {
  readonly name: string;
  execute(input: GuidanceCritiqueInput): Promise<GuidancePlanCritique>;
}

export class DefaultGuidanceCritiqueSkill implements GuidanceCritiqueSkill {
  readonly name = 'daily-work-guidance-critique';

  constructor(private readonly model: LanguageModel) {}

  async execute(input: GuidanceCritiqueInput): Promise<GuidancePlanCritique> {
    const prompt = buildPrompt(input);
    const { text } = await this.model.generate({ prompt });
    return parseOutput(text);
  }
}
