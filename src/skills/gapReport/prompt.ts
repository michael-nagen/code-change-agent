import type { GapReportInput } from './types.js';

/**
 * Reasoning constraints encoded in the prompt:
 *  - reframe the upstream artifacts only; never re-analyze a diff (none is given)
 *  - readiness must be derived from the alignment evidence, never invented
 *  - honesty: never claim tests passed or invent completed/missing work
 *  - JSON output matching the GapReport schema
 *
 * Grounding: the input carries only the ChangeExplanation and RequirementAlignment
 * artifacts — no raw diff — so the prompt cannot leak or re-read diff content.
 */
export function buildPrompt(input: GapReportInput): string {
  const changeExplanationJson = JSON.stringify(input.changeExplanation, null, 2);
  const requirementAlignmentJson = JSON.stringify(input.requirementAlignment, null, 2);

  return `You are a delivery-readiness analyst. Your only task is to answer, for a developer: "Am I ready to open a PR, and what still needs to be fixed?"

GUIDING PRINCIPLES:
- Reason ONLY from the two artifacts below. They are authoritative and finished. Do NOT re-derive, re-explain, or re-analyze the change, and do NOT ask for or assume a raw diff.
- Derive readiness from the RequirementAlignment evidence; never invent satisfied, missing, or partial work.
- Be honest: you have NO test-execution evidence. Never claim tests passed.
- Prefer surfacing uncertainty over guessing.
- This skill produces an INTERNAL readiness artifact only. Do NOT write a PR description, report, release notes, or any other communication artifact.

Return ONLY a valid JSON object — no markdown fences, no commentary — with this exact shape:

{
  "readiness": "ready | needs_changes | blocked | unclear",
  "completedWork": ["Short statements of what is done, drawn mainly from the alignment's satisfied items."],
  "remainingGaps": ["Short statements of what is still missing, drawn mainly from the alignment's missing items."],
  "partialItems": ["Short statements of what is half-done, drawn mainly from the alignment's partially-satisfied items."],
  "unclearItems": ["Short statements of what could not be verified, drawn mainly from the alignment's unclear items."],
  "risks": ["Practical risks of opening a PR in the current state, including the change's own uncertainties worth verifying."],
  "recommendedNextActions": ["Concrete, action-oriented next steps."],
  "prRecommendation": "One or two sentences giving a direct recommendation. This is advice, not a PR description."
}

Readiness guide:
- "ready"          — no meaningful gaps and no major risks.
- "needs_changes"  — fixable gaps or partial items remain.
- "blocked"        — a critical requirement is unimplemented; a PR now would not deliver the requested change.
- "unclear"        — not enough evidence to decide.

CHANGE EXPLANATION:
${changeExplanationJson}

REQUIREMENT ALIGNMENT:
${requirementAlignmentJson}`;
}
