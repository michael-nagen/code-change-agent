import type { LanguageModel } from '../../llm/LanguageModel.js';
import type { PRDescription, PRDescriptionInput } from './types.js';
import { buildPrompt } from './prompt.js';
import { parseOutput } from './parseOutput.js';

/**
 * Assembles a GitHub-ready PR description from the four upstream artifacts.
 *
 * It is LLM-backed: it reasons over the four upstream artifacts only. Its input
 * deliberately excludes the raw diff, so it cannot re-analyze the change or
 * regenerate upstream artifacts. The prompt forbids claiming tests passed or
 * inventing coverage.
 */
export interface PRDescriptionSkill {
  readonly name: string;
  execute(input: PRDescriptionInput): Promise<PRDescription>;
}

export class DefaultPRDescriptionSkill implements PRDescriptionSkill {
  readonly name = 'pr-description';

  constructor(private readonly model: LanguageModel) {}

  async execute(input: PRDescriptionInput): Promise<PRDescription> {
    const prompt = buildPrompt(input);
    const { text } = await this.model.generate({ prompt });
    return parseOutput(text);
  }
}
