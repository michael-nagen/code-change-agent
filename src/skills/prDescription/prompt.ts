import type { PRDescriptionInput } from './types.js';

/**
 * Reasoning constraints encoded in the prompt:
 *  - assemble from the four upstream artifacts only; never re-analyze a diff
 *  - honesty: never claim tests passed or invent coverage
 *  - embed the FlowArtifact's existing Mermaid diagram, do not redraw it
 *  - JSON output matching the PRDescription schema
 *
 * Grounding: the input carries only the four artifacts — no raw diff.
 */
export function buildPrompt(input: PRDescriptionInput): string {
  const changeExplanationJson = JSON.stringify(input.changeExplanation, null, 2);
  const requirementAlignmentJson = JSON.stringify(input.requirementAlignment, null, 2);
  const gapReportJson = JSON.stringify(input.gapReport, null, 2);
  const flowArtifactJson = JSON.stringify(input.flowArtifact, null, 2);

  return `You are a senior engineer writing a clear, honest GitHub pull request description. Assemble it from the four upstream artifacts below.

GUIDING PRINCIPLES:
- Reason ONLY from the artifacts below. They are authoritative and finished. Do NOT re-derive or re-analyze the change, and do NOT ask for or assume a raw diff.
- Be honest: you have NO test-execution evidence. testingNotes must suggest what to test and must never claim tests already passed.
- requirementCoverage must reflect the alignment honestly, labeling satisfied, partial, missing, and unclear items.
- featureFlow must embed the FlowArtifact's existing Mermaid diagram inside a fenced \`\`\`mermaid block; do not invent a new diagram.
- risksAndFollowUps should carry the gap report's risks and recommended next actions.

Return ONLY a valid JSON object — no markdown fences around the whole object, no commentary — with this exact shape:

{
  "title": "A concise PR title.",
  "summary": "A short paragraph: what changed and the readiness verdict.",
  "whatChanged": ["Capabilities introduced or modified."],
  "requirementCoverage": ["Per-item coverage, each prefixed with Satisfied/Partial/Missing/Unclear."],
  "featureFlow": "Prose describing the runtime flow, containing the embedded mermaid code block.",
  "testingNotes": ["Suggested testing. Never a claim that tests passed."],
  "risksAndFollowUps": ["Risks and follow-up actions carried from the gap report."]
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
