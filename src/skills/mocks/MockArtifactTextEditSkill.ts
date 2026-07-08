import type {
  ArtifactTextEditInput,
  ArtifactTextEditResult,
  ArtifactTextEditSkill,
} from '../artifactTextEdit/index.js';

const MOCK_TAG = '[DEMO/MOCK OUTPUT — not real AI]';

/**
 * Deterministic stand-in for the text-edit skill so the mock UI/Telegram flow
 * exercises the full reply-to-edit loop without a model. It echoes the request
 * and returns the original artifact text prefixed with a clearly-mock note, so
 * downstream behavior (send, buttons, `/latest` update) can be verified end to
 * end. It never claims a real transformation.
 */
export class MockArtifactTextEditSkill implements ArtifactTextEditSkill {
  readonly name = 'mock-artifact-text-edit';

  async execute(input: ArtifactTextEditInput): Promise<ArtifactTextEditResult> {
    const instruction = input.instruction.trim();
    return {
      text: `${MOCK_TAG}\nEdit applied to ${input.artifactLabel}: "${instruction}"\n\n${input.originalText}`,
      changeSummary: `${MOCK_TAG} Applied edit: ${instruction}`,
    };
  }
}
