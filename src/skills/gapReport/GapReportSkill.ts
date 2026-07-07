import type { LanguageModel } from '../../llm/LanguageModel.js';
import type { GapReport, GapReportInput } from './types.js';
import { buildPrompt } from './prompt.js';
import { parseOutput } from './parseOutput.js';

/**
 * Turns the ChangeExplanation + RequirementAlignment artifacts into a
 * developer-facing answer to "Am I ready to open a PR, and what still needs to
 * be fixed?".
 *
 * It is LLM-backed: it reasons over the two upstream artifacts only. Its input
 * deliberately excludes the raw diff, so it cannot re-analyze the change,
 * regenerate upstream artifacts, or invent requirements.
 */
export interface GapReportSkill {
  readonly name: string;
  execute(input: GapReportInput): Promise<GapReport>;
}

export class DefaultGapReportSkill implements GapReportSkill {
  readonly name = 'gap-report';

  constructor(private readonly model: LanguageModel) {}

  async execute(input: GapReportInput): Promise<GapReport> {
    const prompt = buildPrompt(input);
    const { text } = await this.model.generate({ prompt });
    return parseOutput(text);
  }
}
