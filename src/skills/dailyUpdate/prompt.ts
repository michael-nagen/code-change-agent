import type { DailyUpdateInput } from './types.js';

/**
 * Reasoning constraints encoded in the prompt:
 *  - reframe the five upstream artifacts only; never re-analyze a diff
 *  - the PRDescription is communication framing, not a fact source
 *  - honesty: invent no work that no artifact reports
 *  - JSON output matching the DailyUpdate schema
 *
 * Grounding: the input carries only the five artifacts — no raw diff.
 */
export function buildPrompt(input: DailyUpdateInput): string {
  const changeExplanationJson = JSON.stringify(input.changeExplanation, null, 2);
  const requirementAlignmentJson = JSON.stringify(input.requirementAlignment, null, 2);
  const gapReportJson = JSON.stringify(input.gapReport, null, 2);
  const prDescriptionJson = JSON.stringify(input.prDescription, null, 2);
  const flowArtifactJson = JSON.stringify(input.flowArtifact, null, 2);

  return `You are helping a developer prepare a short standup update, using only the five upstream artifacts below.

GUIDING PRINCIPLES:
- Reason ONLY from the artifacts below. They are authoritative and finished. Do NOT re-derive or re-analyze the change, and do NOT ask for or assume a raw diff.
- Roles: ChangeExplanation → what was implemented ("yesterday"); GapReport → recommended next actions ("today") plus risks; RequirementAlignment → partial/missing/unclear items; FlowArtifact → help explain the highlighted topic; PRDescription → communication context only, NEVER a source of facts.
- Be honest: invent no work that no artifact reports. Keep bullet lists short enough to say out loud.
- spokenVersion must be a natural paragraph a developer can read aloud in about 30–60 seconds.

Return ONLY a valid JSON object — no markdown fences, no commentary — with this exact shape:

{
  "headline": "One-sentence status summary.",
  "yesterdaySummary": ["What was completed or built."],
  "todaySuggestions": ["Next steps."],
  "blockersOrRisks": ["Honest risks/gaps/unclear items, or a single 'No known blockers or risks.' if none."],
  "highlightedTopic": {
    "title": "One meaningful topic worth expanding on.",
    "explanation": "A couple of sentences explaining it.",
    "whyItMatters": "Why it matters."
  },
  "spokenVersion": "A natural, ready-to-say paragraph."
}

CHANGE EXPLANATION:
${changeExplanationJson}

REQUIREMENT ALIGNMENT:
${requirementAlignmentJson}

GAP REPORT:
${gapReportJson}

PR DESCRIPTION (communication context only):
${prDescriptionJson}

FLOW ARTIFACT:
${flowArtifactJson}`;
}
