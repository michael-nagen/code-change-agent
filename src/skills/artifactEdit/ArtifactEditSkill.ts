import type { LanguageModel } from '../../llm/LanguageModel.js';
import type { ArtifactEditInput, ArtifactEditResult } from './types.js';
import { buildPrompt } from './prompt.js';
import { parseOutput } from './parseOutput.js';

/**
 * Edits a single, already-generated text artifact through a conversation.
 *
 * It is LLM-backed and reasons ONLY over the selected artifact plus read-only
 * session context. Its input deliberately excludes the raw diff, so it can
 * neither re-analyze the change nor regenerate upstream artifacts. The returned
 * `updatedArtifact` is validated against the schema of `selectedArtifactKey`.
 *
 * Explicit non-goals: this skill does NOT run the analysis workflow, generate
 * missing artifacts, edit raw JSON, or touch any artifact other than the
 * selected one.
 */
export interface ArtifactEditSkill {
  readonly name: string;
  execute(input: ArtifactEditInput): Promise<ArtifactEditResult>;
}

export class DefaultArtifactEditSkill implements ArtifactEditSkill {
  readonly name = 'artifact-edit';

  constructor(private readonly model: LanguageModel) {}

  async execute(input: ArtifactEditInput): Promise<ArtifactEditResult> {
    const prompt = buildPrompt(input);
    const { text } = await this.model.generate({ prompt });
    return parseOutput(text, input.selectedArtifactKey);
  }
}
