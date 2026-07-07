import type { LanguageModel } from '../../llm/LanguageModel.js';
import type { DailyWorkGuidance, DailyWorkGuidanceInput } from './types.js';
import { buildPrompt } from './prompt.js';
import { parseOutput } from './parseOutput.js';

/**
 * Turns the spec/checklist, previous progress memory, and upstream artifacts
 * into forward-looking guidance for the day.
 *
 * It is LLM-backed: it reasons over the spec, the prior memory, an optional
 * goal, and the four upstream artifacts only. Its input deliberately excludes
 * the raw diff, so it cannot re-read or re-analyze the change or invent work no
 * artifact reports. It separates what was done from what to do next, and derives
 * the daily update draft and savable memory update from the real progress.
 */
export interface DailyWorkGuidanceSkill {
  readonly name: string;
  execute(input: DailyWorkGuidanceInput): Promise<DailyWorkGuidance>;
}

export class DefaultDailyWorkGuidanceSkill implements DailyWorkGuidanceSkill {
  readonly name = 'daily-work-guidance';

  constructor(private readonly model: LanguageModel) {}

  async execute(input: DailyWorkGuidanceInput): Promise<DailyWorkGuidance> {
    const prompt = buildPrompt(input);
    const { text } = await this.model.generate({ prompt });
    return parseOutput(text);
  }
}
