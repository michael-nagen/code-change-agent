import type { RequirementAlignmentInput } from './types.js';
import {
  UNTRUSTED_CONTENT_SAFETY_INSTRUCTION,
  fenceUntrustedContent,
} from '../shared/untrustedContent.js';

/**
 * Reasoning constraints encoded in the prompt:
 *  - outcomes, not code volume
 *  - evidence-based statements only (requirement text → explanation → diff)
 *  - explicit reasoning order to enforce that ChangeExplanation is primary
 *  - rawDiff is optional secondary evidence, included only when provided
 *  - uncertainty over hallucination
 *  - JSON output matching the RequirementAlignment schema
 *
 * The requirement text and raw diff are untrusted source content, so they are
 * fenced and preceded by the shared safety preamble; the ChangeExplanation is a
 * validated upstream artifact and stays outside the fence.
 */
export function buildPrompt(input: RequirementAlignmentInput): string {
  const explanationJson = JSON.stringify(input.changeExplanation, null, 2);

  const diffSection =
    input.rawDiff !== undefined
      ? fenceUntrustedContent({
          label:
            'RAW DIFF (secondary evidence — consult only to resolve specific uncertainties not already answered by the Change Explanation above)',
          content: input.rawDiff,
        })
      : `RAW DIFF: Not provided. Reason only from the Requirement and Change Explanation above.`;

  return `You are a requirement alignment analyst. Your only task is to evaluate whether the implemented change satisfies the original requirement.

${UNTRUSTED_CONTENT_SAFETY_INSTRUCTION}

GUIDING PRINCIPLES:
- You are an ALIGNMENT EVALUATOR, not a diff analyzer. Treat the Change Explanation as a finished, authoritative artifact describing what was implemented. Do NOT regenerate, re-derive, or re-explain the change.
- Evaluate OUTCOMES, not code volume. Say "The requested planning capability appears implemented", not "Several files were modified".
- Every alignment statement must be grounded in evidence: requirement text, the Change Explanation, or (as a last resort) the raw diff.
- Prefer UNCERTAINTY over hallucination. Never invent completed work, missing work, production usage, or business decisions.
- Only assess aspects that the requirement actually asked for. Do NOT invent desirable-but-unrequested features and report them as missing — missingItems must trace back to an explicit requirement aspect.
- If alignment cannot be confidently determined, add the item to unclearItems. Do not guess.
- This skill produces INTERNAL ALIGNMENT KNOWLEDGE only. Do NOT generate PR descriptions, reports, summaries, release notes, video scripts, slides, diagrams, or any user-facing communication artifact.

REASONING ORDER (follow this exactly):
1. Analyze the requirement — what was asked for?
2. Analyze the Change Explanation — what was built? (this is the PRIMARY evidence)
3. Evaluate alignment between requirement and explanation.
4. Only if step 3 leaves genuine uncertainty, consult the Raw Diff to resolve it.
   If alignment still cannot be determined after consulting the diff, add the item to unclearItems.

Return ONLY a valid JSON object — no markdown fences, no explanation text — with this exact shape:

{
  "requirementSummary": "One or two sentences summarizing what was originally requested.",
  "satisfiedItems": [
    "Each item is a short sentence stating a requirement aspect that appears clearly and fully satisfied, citing evidence from the Change Explanation."
  ],
  "partiallySatisfiedItems": [
    "Each item is a short sentence stating a requirement aspect that appears only partially addressed, with a note on what is present and what is still missing."
  ],
  "missingItems": [
    "Each item is a short sentence stating an explicitly requested requirement aspect that appears entirely absent from the change. Do not list features that were never requested."
  ],
  "unclearItems": [
    "Each item is a short sentence naming a requirement aspect that cannot be verified with the available evidence. Use this rather than guessing."
  ],
  "overallAssessment": "Two to four sentences summarizing the overall alignment: what was built, what gaps exist, and how confidently this can be assessed.",
  "confidence": "high | medium | low"
}

Confidence guide:
- "high"   — Requirement is clear and the Change Explanation provides strong, direct evidence.
- "medium" — Requirement is mostly clear but some assumptions are required to draw conclusions.
- "low"    — Requirement is ambiguous or alignment cannot be confidently determined from available evidence.

${fenceUntrustedContent({ label: 'REQUIREMENT', content: input.requirementText })}

CHANGE EXPLANATION (primary evidence):
${explanationJson}

${diffSection}`;
}
