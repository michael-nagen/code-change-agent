import type { TechnicalChangeBriefInput } from './types.js';
import {
  UNTRUSTED_CONTENT_SAFETY_INSTRUCTION,
  fenceUntrustedContent,
  renderConnectedSourceContextSection,
} from '../shared/untrustedContent.js';

/**
 * Reasoning constraints encoded in the prompt:
 *  - explain the ACTUAL implementation of the change, technically and clearly,
 *    for a PR/demo/walkthrough/technical discussion — NOT reviewer questions,
 *    and NOT a PR description
 *  - reason from the raw diff plus the upstream analysis artifacts; the diff is
 *    the source of truth for concrete details (files, fields, flags)
 *  - never invent files, fields, endpoints, or schema changes; when evidence is
 *    missing, say "not visible from the provided diff/analysis"
 *  - separate confirmed implementation details (evidence: "confirmed") from
 *    inferred impact (evidence: "inferred")
 *  - state "no data/schema changes" or "no UI changes" explicitly when true
 *  - JSON output matching the TechnicalChangeBrief schema
 *
 * Grounding: the input carries the raw diff, the requirement/spec, the change
 * explanation, the requirement alignment, and — when available — the gap report,
 * the flow artifact, and the daily work guidance.
 */
export function buildPrompt(input: TechnicalChangeBriefInput): string {
  const changeExplanationJson = JSON.stringify(input.changeExplanation, null, 2);
  const requirementAlignmentJson = JSON.stringify(input.requirementAlignment, null, 2);

  const gapReportSection =
    input.gapReport !== undefined
      ? JSON.stringify(input.gapReport, null, 2)
      : 'Not available — the gap report was not generated for this analysis.';

  const flowArtifactSection =
    input.flowArtifact !== undefined
      ? JSON.stringify(input.flowArtifact, null, 2)
      : 'Not available — the flow artifact was not generated for this analysis.';

  const dailyWorkGuidanceSection =
    input.dailyWorkGuidance !== undefined
      ? JSON.stringify(input.dailyWorkGuidance, null, 2)
      : 'Not available — daily work guidance was not generated for this analysis.';

  const userPreferencesSection =
    input.userPromptPreferences !== undefined && input.userPromptPreferences.trim() !== ''
      ? `\n\n${input.userPromptPreferences}`
      : '';

  const connectedSourceSection = renderConnectedSourceContextSection(input.connectedSourceContext);

  return `You are a Staff Engineer preparing a TECHNICAL CHANGE BRIEF: a clear, implementation-focused explanation of what a code change did. It helps the author explain the work in a PR, demo, walkthrough, or technical discussion.

${UNTRUSTED_CONTENT_SAFETY_INSTRUCTION}

WHAT THIS IS:
- A technical explanation of the ACTUAL implementation: schema/model/API/workflow/UI changes, the most interesting functionality, an end-to-end flow, the files worth showing, and talking points.

WHAT THIS IS NOT:
- NOT a PR description (do not duplicate that artifact).
- NOT a reviewer-question generator. Do NOT focus on questions a reviewer might ask.
- NOT a rewrite of the requirement. Focus on what changed and why it matters.

GROUNDING & HONESTY RULES:
- The RAW DIFF below is the source of truth for concrete details (files, fields, flags). Reason from it plus the analysis artifacts.
- Do NOT invent files, fields, endpoints, or schema changes. If something is not evident, write exactly: "not visible from the provided diff/analysis".
- Separate CONFIRMED implementation details from INFERRED impact. For every item that has an "evidence" field, set it to "confirmed" when the detail is directly visible in the diff/analysis, or "inferred" when it is a reasonable interpretation you cannot directly see.
- Prefer concrete file paths and names when the diff shows them; omit filePath when unknown rather than guessing.
- If there are no data/schema changes, set dataSchemaChanges.hasChanges to false and say so clearly in its summary. If there are no UI changes, set uiChanges.hasChanges to false and say so clearly in its summary.

Return ONLY a valid JSON object — no markdown fences, no commentary — with this exact shape:

{
  "executiveSummary": "A short summary of what was built and why.",
  "dataSchemaChanges": {
    "hasChanges": true,
    "summary": "Short prose. If nothing changed, say so clearly.",
    "newFields": [ { "name": "...", "filePath": "path if known (omit if unknown)", "description": "What/why at the data level.", "evidence": "confirmed | inferred" } ],
    "changedFields": [ { "name": "...", "description": "...", "evidence": "confirmed | inferred" } ],
    "removedFields": [ { "name": "...", "description": "...", "evidence": "confirmed | inferred" } ],
    "newSchemas": [ { "name": "...", "description": "A new artifact/output schema.", "evidence": "confirmed | inferred" } ],
    "changedParserContracts": [ { "name": "...", "description": "A changed parser/serialization contract.", "evidence": "confirmed | inferred" } ],
    "newStatusValues": [ { "name": "...", "description": "A new status value or enum member.", "evidence": "confirmed | inferred" } ],
    "persistedDataImpact": "Whether existing persisted/session data is affected.",
    "backwardCompatibility": "compatible | breaking | unclear",
    "backwardCompatibilityNote": "A short note explaining the call."
  },
  "modelsAndTypes": [
    { "name": "...", "filePath": "path if known (omit if unknown)", "represents": "What it represents.", "whyNeeded": "Why it was needed.", "importantFields": ["field: meaning"], "evidence": "confirmed | inferred" }
  ],
  "inputsApiFlags": [
    { "name": "...", "kind": "includeFlag | requestField | optionalInput | requiredInput | artifactKey | route | other", "description": "What it is and how it is used.", "filePath": "path if known (omit if unknown)", "evidence": "confirmed | inferred" }
  ],
  "workflowRuntimeChanges": {
    "summary": "Short prose on the workflow/runtime impact.",
    "whereItRuns": "Where the new step/logic runs in the pipeline.",
    "dependsOn": ["What it depends on."],
    "consumesArtifacts": ["Artifacts it consumes."],
    "producesArtifact": "The artifact it produces, or 'None'.",
    "cachedOrReused": "Whether it is cached/reused.",
    "behaviorWhenFlagOff": "What happens when its flag is off."
  },
  "uiChanges": {
    "hasChanges": true,
    "summary": "Short prose. If nothing changed, say so clearly.",
    "newCardsOrViews": ["..."],
    "togglesOrButtons": ["..."],
    "copyActions": ["..."],
    "sectionsDisplayed": ["..."],
    "howToActivate": "How the user activates the feature."
  },
  "interestingFunctionality": [
    { "title": "...", "whatItDoes": "...", "whyItMatters": "...", "howItWorks": "How it works internally.", "filesInvolved": ["path"] }
  ],
  "howItWorksStepByStep": [
    { "actor": "Who/what performs this (optional, omit if not useful)", "action": "The action taken.", "detail": "Optional extra technical detail (omit if none)." }
  ],
  "filesWorthShowing": [
    { "path": "...", "whyItMatters": "...", "whatToPointOut": "..." }
  ],
  "talkingPoints": ["Concise bullet the author can say when explaining the change."]
}

Keep the tone clear, technical, practical, and not too long — focused on what changed and why it matters.${userPreferencesSection}

${fenceUntrustedContent({ label: 'REQUIREMENT / SPEC', content: input.requirementText })}

${fenceUntrustedContent({ label: 'RAW DIFF', content: input.rawDiff })}

CHANGE EXPLANATION:
${changeExplanationJson}

REQUIREMENT ALIGNMENT:
${requirementAlignmentJson}

GAP REPORT:
${gapReportSection}

FLOW ARTIFACT:
${flowArtifactSection}

DAILY WORK GUIDANCE:
${dailyWorkGuidanceSection}${connectedSourceSection}`;
}
