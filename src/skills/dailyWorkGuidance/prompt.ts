import type { DailyWorkGuidanceInput } from './types.js';
import {
  UNTRUSTED_CONTENT_SAFETY_INSTRUCTION,
  fenceUntrustedContent,
  renderConnectedSourceContextSection,
} from '../shared/untrustedContent.js';

/**
 * Reasoning constraints encoded in the prompt:
 *  - reason ONLY from the spec, prior memory, the goal, and the upstream
 *    artifacts; never re-derive or re-analyze a diff, and never assume one exists
 *  - separate "what was done yesterday" (grounded in the analysis) from
 *    "what to do next"
 *  - compare explicitly against the spec/checklist, classifying each item
 *    done/partial/missing/blocked/unclear with a previous status when known
 *  - surface blockers/risks and decisions the developer must approve
 *  - keep EVERY planned step and decision as pending_approval — the plan is a
 *    proposal, never final
 *  - produce a fixed-format Notion daily update derived from the real progress
 *  - produce a structured, savable memory update stamped with the given date
 *  - JSON output matching the DailyWorkGuidance schema
 *
 * Grounding: the input carries the spec/checklist, the date, optional prior
 * memory, an optional goal, and the four upstream artifacts — no raw diff.
 */
export function buildPrompt(input: DailyWorkGuidanceInput): string {
  const changeExplanationJson = JSON.stringify(input.changeExplanation, null, 2);
  const requirementAlignmentJson = JSON.stringify(input.requirementAlignment, null, 2);
  const gapReportJson = JSON.stringify(input.gapReport, null, 2);
  const flowArtifactJson = JSON.stringify(input.flowArtifact, null, 2);

  const previousProgressMemorySection =
    input.previousProgressMemory !== undefined && input.previousProgressMemory.trim() !== ''
      ? fenceUntrustedContent({
          label: 'PREVIOUS PROGRESS MEMORY',
          content: input.previousProgressMemory,
        })
      : 'PREVIOUS PROGRESS MEMORY:\nNone provided — treat this as the first tracked day and leave previous statuses out where unknown.';

  const todayGoal =
    input.todayGoal !== undefined && input.todayGoal.trim() !== ''
      ? input.todayGoal
      : 'None stated — infer the most valuable goal from the spec and the gaps.';

  const userPreferencesSection =
    input.userPromptPreferences !== undefined && input.userPromptPreferences.trim() !== ''
      ? `\n\n${input.userPromptPreferences}`
      : '';

  const connectedSourceSection = renderConnectedSourceContextSection(input.connectedSourceContext);

  return `You are a Developer Work Companion helping a developer decide how to work TODAY. Use only the spec/checklist, the previous progress memory, the goal, and the upstream analysis artifacts below.

${UNTRUSTED_CONTENT_SAFETY_INSTRUCTION}

GUIDING PRINCIPLES:
- Reason ONLY from the inputs below. They are authoritative and finished. Do NOT re-derive or re-analyze the change, and do NOT ask for or assume a raw diff.
- Roles: SPEC/CHECKLIST → the source of truth for what "done" means; PREVIOUS PROGRESS MEMORY → what was already true before yesterday's work, so you can tell what advanced; ChangeExplanation → what yesterday's work implemented; RequirementAlignment → done/partial/missing/unclear vs the spec; GapReport → readiness, risks, and recommended next actions; FlowArtifact → runtime flow, to ground the plan and prompts.
- Cleanly separate what was DONE (yesterdaySummary, progressVsSpec, advancedChecklistItems) from what to do NEXT (plannedSteps, notionDailyUpdate.today, memoryUpdate.nextActions).
- Compare EXPLICITLY against the spec/checklist. In "progressVsSpec", classify each meaningful item's newStatus as one of: done, partial, missing, blocked, unclear. Include previousStatus only when the previous memory makes it known. Describe whatChanged honestly ("No change." when nothing moved), ground "evidence" in the artifacts, and give a confidence of high/medium/low. Prefer "unclear" over inventing evidence.
- "advancedChecklistItems" lists only the items that genuinely moved forward yesterday, each with its previousStatus and newStatus.
- "blockersAndRisks" is top-level and honest; each has a required action or decision. "decisionsNeedingApproval" are choices the developer must make before the plan is final; each has status "pending_approval".
- "plannedSteps" are a PROPOSAL, not final. Every step has status "pending_approval", a ready-to-paste cursorPrompt, a validationChecklist, and relatedSpecItems when known. Order them by priority; honor the stated goal but stay realistic against the gaps and risks. Give each step a stable id like "step-1".
- "notionDailyUpdate" is a fixed-format update DERIVED from the real progress above (not generic): yesterday, today, blockers, decisionsNeeded, progressVsSpec (a short readable summary), nextCursorPrompt (the single most important prompt to run next).
- "memoryUpdate" must be structured to save and reload as next session's previous progress memory. Use EXACTLY this date for memoryUpdate.date: ${input.date}. Be honest: invent no work that no artifact reports.

Return ONLY a valid JSON object — no markdown fences, no commentary — with this exact shape:

{
  "yesterdaySummary": "What was accomplished yesterday, grounded in the analysis.",
  "progressVsSpec": [
    { "item": "A spec/checklist item.", "previousStatus": "done | partial | missing | blocked | unclear (omit if unknown)", "whatChanged": "What yesterday changed for this item.", "newStatus": "done | partial | missing | blocked | unclear", "evidence": "Why, grounded in the analysis.", "confidence": "high | medium | low" }
  ],
  "advancedChecklistItems": [
    { "item": "An item that moved forward.", "previousStatus": "...", "newStatus": "...", "whatAdvanced": "What specifically advanced.", "evidence": "Grounded in the analysis." }
  ],
  "blockersAndRisks": [
    { "title": "Short title.", "description": "What the blocker/risk is.", "whyItMatters": "Impact if unaddressed.", "requiredAction": "The action or decision needed.", "severity": "high | medium | low (optional)" }
  ],
  "decisionsNeedingApproval": [
    { "decision": "The decision to make.", "context": "Why it is needed now.", "options": ["Option A", "Option B"], "recommendedOption": "Your recommendation, if any.", "status": "pending_approval" }
  ],
  "plannedSteps": [
    { "id": "step-1", "title": "What to do.", "whyItMatters": "Why it is worth doing today.", "expectedOutput": "What finishing it produces.", "cursorPrompt": "A ready-to-paste Cursor/Claude prompt.", "validationChecklist": ["How to confirm it is done."], "relatedSpecItems": ["Spec item this advances."], "status": "pending_approval" }
  ],
  "notionDailyUpdate": {
    "yesterday": "Short paragraph of what was done.",
    "today": "Short paragraph of the plan for today.",
    "blockers": "Blockers, or 'None.'",
    "decisionsNeeded": "Decisions needing approval, or 'None.'",
    "progressVsSpec": "A short readable progress-vs-spec summary.",
    "nextCursorPrompt": "The single most important next prompt to run."
  },
  "memoryUpdate": {
    "date": "${input.date}",
    "dailySummary": "One-paragraph summary of the day.",
    "updatedChecklistStatuses": [ { "item": "A spec/checklist item.", "status": "done | partial | missing | blocked | unclear" } ],
    "newDecisions": ["Decisions surfaced today, or none."],
    "openBlockers": ["Blockers still open, or none."],
    "nextActions": ["Next actions to carry into tomorrow."]
  }
}

${fenceUntrustedContent({ label: 'SPEC / CHECKLIST', content: input.specOrChecklist })}

DATE:
${input.date}

${previousProgressMemorySection}${connectedSourceSection}

GOAL FOR TODAY:
${todayGoal}${userPreferencesSection}

CHANGE EXPLANATION (yesterday's work):
${changeExplanationJson}

REQUIREMENT ALIGNMENT:
${requirementAlignmentJson}

GAP REPORT:
${gapReportJson}

FLOW ARTIFACT:
${flowArtifactJson}`;
}
