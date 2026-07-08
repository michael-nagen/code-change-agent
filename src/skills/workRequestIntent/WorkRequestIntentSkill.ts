/**
 * The Work Request Intent skill: LLM-backed classification of a free-text
 * developer message into a structured {@link WorkRequestIntent}.
 *
 * Like every skill it is buildPrompt → model.generate → parse/validate, uses the
 * injectable LanguageModel (no hardcoded provider), and fails closed on invalid
 * output. It performs NO side effects and drives NO workflow — it only interprets.
 */
import type { LanguageModel } from '../../llm/LanguageModel.js';
import { buildPrompt } from './prompt.js';
import { parseOutput } from './parseOutput.js';
import type { WorkRequestIntent, WorkRequestIntentInput } from './types.js';

export interface WorkRequestIntentSkill {
  readonly name: string;
  execute(input: WorkRequestIntentInput): Promise<WorkRequestIntent>;
}

export class DefaultWorkRequestIntentSkill implements WorkRequestIntentSkill {
  readonly name = 'work-request-intent';

  constructor(private readonly model: LanguageModel) {}

  async execute(input: WorkRequestIntentInput): Promise<WorkRequestIntent> {
    const prompt = buildPrompt(input);
    const { text } = await this.model.generate({ prompt });
    return parseOutput(text);
  }
}
