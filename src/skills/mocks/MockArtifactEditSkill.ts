import type {
  ArtifactEditInput,
  ArtifactEditResult,
  ArtifactEditSkill,
  EditableArtifact,
  EditableArtifactKey,
} from '../artifactEdit/index.js';
import type { PRDescription } from '../prDescription/index.js';
import type { VideoScript } from '../videoScript/index.js';
import type { DailyUpdate } from '../dailyUpdate/index.js';

const MOCK_TAG = '[DEMO/MOCK OUTPUT — not real AI]';

/**
 * Deterministic, provider-free ArtifactEditSkill for DEMO/MOCK mode.
 *
 * It performs no real reasoning: it applies a clearly-labeled visible change to
 * one field of the selected artifact (preserving its schema) so the UI's edit
 * flow can be exercised end-to-end without a live model. All inserted text is
 * tagged so it can never be mistaken for real AI output.
 */
export class MockArtifactEditSkill implements ArtifactEditSkill {
  readonly name = 'mock-artifact-edit';

  async execute(input: ArtifactEditInput): Promise<ArtifactEditResult> {
    const updatedArtifact = applyDemoEdit(
      input.selectedArtifactKey,
      input.selectedArtifact,
      input.userMessage,
    );
    return {
      assistantMessage: `${MOCK_TAG} Demo mode — no real edit was performed. You asked: "${input.userMessage}".`,
      updatedArtifact,
      changeSummary: `${MOCK_TAG} Demo edit applied to ${input.selectedArtifactKey}.`,
    };
  }
}

function applyDemoEdit(
  key: EditableArtifactKey,
  artifact: EditableArtifact,
  message: string,
): EditableArtifact {
  const marker = `${MOCK_TAG} (edited per: "${message}") `;
  switch (key) {
    case 'prDescription': {
      const pr = structuredClone(artifact) as PRDescription;
      pr.summary = `${marker}${pr.summary}`;
      return pr;
    }
    case 'videoScript': {
      const vs = structuredClone(artifact) as VideoScript;
      vs.title = `${marker}${vs.title}`;
      return vs;
    }
    case 'dailyUpdate': {
      const du = structuredClone(artifact) as DailyUpdate;
      du.headline = `${marker}${du.headline}`;
      return du;
    }
    default: {
      const exhaustive: never = key;
      return exhaustive;
    }
  }
}
