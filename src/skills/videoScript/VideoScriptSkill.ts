import type { LanguageModel } from '../../llm/LanguageModel.js';
import type { VideoScript, VideoScriptInput } from './types.js';
import { buildPrompt } from './prompt.js';
import { parseOutput } from './parseOutput.js';

/**
 * Turns the four upstream artifacts into a short developer walkthrough script.
 *
 * It is LLM-backed: it reasons over the four upstream artifacts only. Its input
 * deliberately excludes the raw diff, so it cannot re-read or re-analyze the
 * change, regenerate upstream artifacts, or invent UI screens or integrations.
 */
export interface VideoScriptSkill {
  readonly name: string;
  execute(input: VideoScriptInput): Promise<VideoScript>;
}

export class DefaultVideoScriptSkill implements VideoScriptSkill {
  readonly name = 'video-script';

  constructor(private readonly model: LanguageModel) {}

  async execute(input: VideoScriptInput): Promise<VideoScript> {
    const prompt = buildPrompt(input);
    const { text } = await this.model.generate({ prompt });
    return parseOutput(text);
  }
}
