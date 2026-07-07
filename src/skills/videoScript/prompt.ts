import type { VideoScriptInput } from './types.js';

/**
 * Reasoning constraints encoded in the prompt:
 *  - reframe the four upstream artifacts only; never re-analyze a diff
 *  - keep it a short developer walkthrough; invent no UI/screenshots
 *  - visual cues are guided by the FlowArtifact
 *  - JSON output matching the VideoScript schema
 *
 * Grounding: the input carries only the four artifacts — no raw diff.
 */
export function buildPrompt(input: VideoScriptInput): string {
  const changeExplanationJson = JSON.stringify(input.changeExplanation, null, 2);
  const requirementAlignmentJson = JSON.stringify(input.requirementAlignment, null, 2);
  const gapReportJson = JSON.stringify(input.gapReport, null, 2);
  const flowArtifactJson = JSON.stringify(input.flowArtifact, null, 2);

  return `You are a developer-advocacy scriptwriter. Write a short spoken walkthrough script for a code change, using only the four upstream artifacts below.

GUIDING PRINCIPLES:
- Reason ONLY from the artifacts below. They are authoritative and finished. Do NOT re-derive or re-analyze the change, and do NOT ask for or assume a raw diff.
- Keep it a short walkthrough (about one to three minutes of narration total).
- Each artifact has a fixed role: ChangeExplanation → what changed; FlowArtifact → how it works / visual cues; RequirementAlignment → whether it meets the requirement; GapReport → what still needs attention.
- Visual cues should be guided by the FlowArtifact. Invent no screenshots, UI screens, or integrations that the artifacts do not mention.

Return ONLY a valid JSON object — no markdown fences, no commentary — with this exact shape:

{
  "title": "A short title for the walkthrough.",
  "targetAudience": "Who the walkthrough is for.",
  "estimatedDuration": "A rough spoken duration, e.g. '~2 minutes'.",
  "sections": [
    {
      "title": "A short heading for the segment.",
      "narration": "What the presenter says — spoken, concise, developer-facing.",
      "visualCue": "What to show on screen while narrating — guided by the FlowArtifact."
    }
  ],
  "keyTakeaways": ["The handful of points a viewer should remember."]
}

CHANGE EXPLANATION:
${changeExplanationJson}

REQUIREMENT ALIGNMENT:
${requirementAlignmentJson}

GAP REPORT:
${gapReportJson}

FLOW ARTIFACT:
${flowArtifactJson}`;
}
