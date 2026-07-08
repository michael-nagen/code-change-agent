import type { DailyWorkGuidanceInput } from './types.js';
import {
  UNTRUSTED_CONTENT_SAFETY_INSTRUCTION,
  fenceUntrustedContent,
  renderConnectedSourceContextSection,
} from '../shared/untrustedContent.js';

/**
 * Reasoning constraints encoded in the prompt:
 *  - produce a SHORT work checkpoint, not a full report
 *  - reason ONLY from the spec, prior memory, the goal, and the upstream
 *    artifacts; never re-derive or re-analyze a diff, and never assume one exists
 *  - "what we did" is one sentence per topic; "what to do next" is one sentence
 *    per action; skip trivial items; never duplicate a progress/checklist section
 *  - surface ONLY the important blockers or decisions (omit when there are none)
 *  - still emit the Notion daily block and the savable memory update, derived
 *    from the checkpoint, so the footer actions (Send to Notion / Save to memory)
 *    keep working
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
      : 'PREVIOUS PROGRESS MEMORY:\nNone provided — treat this as the first tracked day.';

  const todayGoal =
    input.todayGoal !== undefined && input.todayGoal.trim() !== ''
      ? input.todayGoal
      : 'None stated — infer the most valuable goal from the spec and the gaps.';

  const userPreferencesSection =
    input.userPromptPreferences !== undefined && input.userPromptPreferences.trim() !== ''
      ? `\n\n${input.userPromptPreferences}`
      : '';

  const connectedSourceSection = renderConnectedSourceContextSection(input.connectedSourceContext);

  return `You are a Developer Work Companion writing a SHORT WORK CHECKPOINT for TODAY — not a full report. Use only the spec/checklist, the previous progress memory, the goal, and the upstream analysis artifacts below.

${UNTRUSTED_CONTENT_SAFETY_INSTRUCTION}

GUIDING PRINCIPLES:
- Reason ONLY from the inputs below. They are authoritative and finished. Do NOT re-derive or re-analyze the change, and do NOT ask for or assume a raw diff.
- Keep it SHORT and skimmable. This is a checkpoint the developer reads in under a minute, then edits by chatting with the companion — not a document with many sections.
- "whatChanged": what was actually done, ONE crisp sentence per topic. Group related work into a single line. Skip trivial items (typos, formatting, tiny renames). No status tags, no per-item evidence, no checklist restatement.
- "nextActions": what to do next, ONE crisp, actionable sentence per action. Order by priority; honor the stated goal but stay realistic against the gaps. Give AT MOST 1–3 actions — pick the highest-signal ones and never pad. When a real trap or wrong turn matters, one action may be phrased as what to AVOID (e.g. "Avoid …").
- "blockersOrDecisions": ONLY the important blockers or decisions that actually need attention. Each is one sentence. Return an empty array when there is nothing important — do NOT invent blockers or decisions to fill the field.
- Be honest: invent no work that no artifact reports. If something is unknown, leave it out rather than guessing.
- "notionDailyUpdate" is a fixed-format update DERIVED from the checkpoint above (for the Send-to-Notion action). "memoryUpdate" is the savable snapshot (for the Save-to-memory action); use EXACTLY this date for memoryUpdate.date: ${input.date}. These are supporting outputs — keep them consistent with whatChanged / nextActions / blockersOrDecisions and do not contradict them.

Return ONLY a valid JSON object — no markdown fences, no commentary — with this exact shape:

{
  "headline": "One line: where the work stands today.",
  "whatChanged": ["What was done — one sentence per topic."],
  "nextActions": ["What to do next — one actionable sentence per action."],
  "blockersOrDecisions": ["Only important blockers or decisions — one sentence each. Empty array if none."],
  "notionDailyUpdate": {
    "yesterday": "Short paragraph of what was done.",
    "today": "Short paragraph of the plan for today.",
    "blockers": "Blockers, or 'None.'",
    "decisionsNeeded": "Decisions needing attention, or 'None.'",
    "progressVsSpec": "A short readable progress-vs-spec summary.",
    "nextCursorPrompt": "A specific, ready-to-run Cursor/Claude prompt for the single most important next action — reference concrete files/areas and the exact outcome, not a generic instruction."
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
