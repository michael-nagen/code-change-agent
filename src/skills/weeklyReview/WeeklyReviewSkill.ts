import type { LanguageModel } from '../../llm/LanguageModel.js';
import type { WeeklyReview, WeeklyReviewInput } from './types.js';
import { buildPrompt } from './prompt.js';
import { parseOutput } from './parseOutput.js';

/**
 * Synthesizes the week into a single WeeklyReview artifact.
 *
 * It is LLM-backed and reasons over the current change plus whichever upstream
 * artifacts and project memory are available — using the Technical Change Brief,
 * Demo Prep Loop, Daily Work Guidance, and prior memory by role. It does not
 * replace those artifacts; it is the higher-level "story of the week". Current
 * inputs are the source of truth over memory, missing inputs are recorded rather
 * than invented, and it fails closed on invalid model output.
 */
export interface WeeklyReviewSkill {
  readonly name: string;
  execute(input: WeeklyReviewInput): Promise<WeeklyReview>;
}

export class DefaultWeeklyReviewSkill implements WeeklyReviewSkill {
  readonly name = 'weekly-review';

  constructor(private readonly model: LanguageModel) {}

  async execute(input: WeeklyReviewInput): Promise<WeeklyReview> {
    const prompt = buildPrompt(input);
    const { text } = await this.model.generate({ prompt });
    return parseOutput(text);
  }
}
