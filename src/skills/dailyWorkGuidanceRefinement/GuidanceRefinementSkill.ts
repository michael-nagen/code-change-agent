import type { LanguageModel } from '../../llm/LanguageModel.js';
import type { GuidancePlanRefinement, GuidanceRefinementInput } from './types.js';
import { buildPrompt } from './prompt.js';
import { parseOutput } from './parseOutput.js';

/**
 * Re-plans the Daily Work Guidance planning sections in response to the
 * user's reject/edit feedback — the model-in-the-loop half of the approval
 * loop.
 *
 * It is LLM-backed but tightly bounded: it sees the decision-annotated
 * guidance, the user's decisions (fenced as untrusted data), and prior
 * memory; it may only propose revised steps for rejected/edited items (all
 * returned pending approval — the parser rejects anything else) and refresh
 * the Notion/memory prose. It never re-runs the base code analysis and never
 * rewrites the factual sections; the deterministic merge in the analysis
 * layer enforces what a revision may replace.
 */
export interface GuidanceRefinementSkill {
  readonly name: string;
  execute(input: GuidanceRefinementInput): Promise<GuidancePlanRefinement>;
}

export class DefaultGuidanceRefinementSkill implements GuidanceRefinementSkill {
  readonly name = 'daily-work-guidance-refinement';

  constructor(private readonly model: LanguageModel) {}

  async execute(input: GuidanceRefinementInput): Promise<GuidancePlanRefinement> {
    const prompt = buildPrompt(input);
    const { text } = await this.model.generate({ prompt });
    return parseOutput(text);
  }
}
