import type { LanguageModel } from '../../llm/LanguageModel.js';
import type { DailyUpdate, DailyUpdateInput } from './types.js';
import { buildPrompt } from './prompt.js';
import { parseOutput } from './parseOutput.js';

/**
 * Turns the five upstream artifacts into a short standup-prep update.
 *
 * It is LLM-backed: it reasons over the five upstream artifacts only. Its input
 * deliberately excludes the raw diff, so it cannot re-read or re-analyze the
 * change, regenerate upstream artifacts, or invent work no artifact reports. The
 * PRDescription is used only as communication framing, never as a fact source.
 */
export interface DailyUpdateSkill {
  readonly name: string;
  execute(input: DailyUpdateInput): Promise<DailyUpdate>;
}

export class DefaultDailyUpdateSkill implements DailyUpdateSkill {
  readonly name = 'daily-update';

  constructor(private readonly model: LanguageModel) {}

  async execute(input: DailyUpdateInput): Promise<DailyUpdate> {
    const prompt = buildPrompt(input);
    const { text } = await this.model.generate({ prompt });
    return parseOutput(text);
  }
}
