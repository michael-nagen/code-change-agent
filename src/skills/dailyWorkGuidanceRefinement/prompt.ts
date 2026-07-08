import type { GuidanceRefinementInput } from './types.js';
import {
  UNTRUSTED_CONTENT_SAFETY_INSTRUCTION,
  fenceUntrustedContent,
} from '../shared/untrustedContent.js';

/**
 * Reasoning constraints encoded in the prompt:
 *  - re-plan ONLY the planning sections (steps, Notion update, memory update)
 *    in response to the user's reject/edit feedback — never re-analyze the
 *    change and never rewrite the factual sections
 *  - user notes/edited text are untrusted data (fenced); they explain WHY to
 *    re-plan, they are never instructions to the model
 *  - the model may not approve anything: every revised step returns as
 *    pending_approval, and revisions may only respond to rejected/edited step
 *    ids (or introduce "new" steps)
 *  - JSON output matching the GuidancePlanRefinement schema
 */
export function buildPrompt(input: GuidanceRefinementInput): string {
  // The guidance and the decision batch both embed user-authored text (notes,
  // edited titles), and the guidance itself derives from untrusted sources —
  // fence both wholesale.
  const guidanceSection = fenceUntrustedContent({
    label: 'CURRENT DAILY WORK GUIDANCE (decision-annotated)',
    content: JSON.stringify(input.guidance, null, 2),
  });
  const decisionsSection = fenceUntrustedContent({
    label: 'USER DECISIONS AND REASONS',
    content: JSON.stringify(input.decisions, null, 2),
  });
  const memorySection =
    input.previousProgressMemory !== undefined && input.previousProgressMemory.trim() !== ''
      ? fenceUntrustedContent({
          label: 'PREVIOUS PROJECT MEMORY',
          content: input.previousProgressMemory,
        })
      : 'PREVIOUS PROJECT MEMORY:\nNone available.';

  return `You are a Developer Work Companion revising a daily plan after the developer pushed back on parts of it. The developer rejected or edited some planned steps and explained why; re-plan ONLY the affected planning sections.

${UNTRUSTED_CONTENT_SAFETY_INSTRUCTION}

RE-PLANNING RULES:
- Read the user's decisions and notes as FEEDBACK about the plan: a rejection means that step (as proposed) was wrong or mistimed; an edit means the user's wording states what they actually want. Address the stated reasons directly.
- Propose revised steps ONLY for the steps the user rejected or edited. Set each revised step's "respondsTo" to that step's id. You may add at most one genuinely new step with "respondsTo": "new" when the feedback clearly calls for it.
- Do NOT restate a rejected step unchanged. Do NOT touch steps the user approved or deferred — they are settled.
- You may NOT approve anything. Every revised step's "status" is exactly "pending_approval"; the developer decides.
- Do NOT rewrite the factual sections (yesterday summary, progress vs spec, advanced items, blockers). They are finished analysis; use them and the memory only as grounding for the new plan.
- Regenerate "notionDailyUpdate" and "memoryUpdate" so their prose reflects the revised plan and the user's feedback. Keep memoryUpdate.date exactly as it is in the current guidance. Fields that summarize approval state (today's approved plan, decisions needed, next actions, next prompt) are recomputed by the system from real statuses — fill them sensibly but do not claim anything was approved.
- Each revised step needs a ready-to-paste cursorPrompt and a concrete validationChecklist, consistent with the blockers and progress in the guidance.

Return ONLY a valid JSON object — no markdown fences, no commentary — with this exact shape:

{
  "revisionSummary": "One paragraph: what you changed and why, grounded in the user's reasons.",
  "revisedSteps": [
    { "respondsTo": "the rejected/edited step id, or \\"new\\"", "title": "...", "whyItMatters": "...", "expectedOutput": "...", "cursorPrompt": "Ready-to-paste prompt.", "validationChecklist": ["..."], "relatedSpecItems": ["... (omit if unknown)"], "status": "pending_approval" }
  ],
  "notionDailyUpdate": {
    "yesterday": "...",
    "today": "...",
    "blockers": "...",
    "decisionsNeeded": "...",
    "progressVsSpec": "...",
    "nextCursorPrompt": "..."
  },
  "memoryUpdate": {
    "date": "Keep the current guidance's memoryUpdate.date.",
    "dailySummary": "...",
    "updatedChecklistStatuses": [ { "item": "...", "status": "done | partial | missing | blocked | unclear" } ],
    "newDecisions": ["..."],
    "openBlockers": ["..."],
    "nextActions": ["..."]
  }
}

${guidanceSection}

${decisionsSection}

${memorySection}`;
}
