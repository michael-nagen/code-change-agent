import type { LanguageModel } from '../../llm/LanguageModel.js';
import type { ArtifactTextEditInput, ArtifactTextEditResult } from './types.js';
import { buildPrompt } from './prompt.js';
import { parseOutput } from './parseOutput.js';

/**
 * Revises one already-rendered text artifact per a freeform edit request.
 *
 * LLM-backed and provider-agnostic (depends only on {@link LanguageModel}). It
 * follows the standard skill flow — buildPrompt → generate → parse → validate —
 * and fails closed on invalid output. It reasons ONLY over the supplied artifact
 * text; it never re-runs analysis, fetches a diff, or edits other artifacts.
 */
export interface ArtifactTextEditSkill {
  readonly name: string;
  execute(input: ArtifactTextEditInput): Promise<ArtifactTextEditResult>;
}

export class DefaultArtifactTextEditSkill implements ArtifactTextEditSkill {
  readonly name = 'artifact-text-edit';

  constructor(private readonly model: LanguageModel) {}

  async execute(input: ArtifactTextEditInput): Promise<ArtifactTextEditResult> {
    const prompt = buildPrompt(input);
    const { text } = await this.model.generate({ prompt });
    return parseOutput(text);
  }
}
