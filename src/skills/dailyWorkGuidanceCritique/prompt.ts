import type { GuidanceCritiqueInput } from './types.js';
import {
  UNTRUSTED_CONTENT_SAFETY_INSTRUCTION,
  fenceUntrustedContent,
} from '../shared/untrustedContent.js';

/**
 * Reasoning constraints encoded in the prompt:
 *  - critique the PLAN against the run's own evidence (progress vs spec,
 *    blockers, gap report, requirement alignment, memory, goal) — never
 *    re-analyze the change and never rewrite the factual sections
 *  - be honest in both directions: report real weaknesses, but say the plan is
 *    sound when it is (revisionNeeded: false) rather than inventing issues
 *  - the critic has no approval authority: every revised step and decision
 *    returns as pending_approval, and only the planning sections may change
 *  - exactly one pass — the output is final, with no follow-up questions
 *  - JSON output matching the GuidancePlanCritique schema
 */
export function buildPrompt(input: GuidanceCritiqueInput): string {
  // The guidance derives from untrusted sources (diff/spec/memory), and the
  // memory and goal are user-provided — fence all three.
  const guidanceSection = fenceUntrustedContent({
    label: 'GENERATED DAILY WORK GUIDANCE (the plan under review)',
    content: JSON.stringify(input.guidance, null, 2),
  });
  const memorySection =
    input.previousProgressMemory !== undefined && input.previousProgressMemory.trim() !== ''
      ? fenceUntrustedContent({
          label: 'PREVIOUS PROJECT MEMORY',
          content: input.previousProgressMemory,
        })
      : 'PREVIOUS PROJECT MEMORY:\nNone available.';
  const goalSection =
    input.todayGoal !== undefined && input.todayGoal.trim() !== ''
      ? fenceUntrustedContent({ label: 'THE DEVELOPER\'S STATED GOAL FOR TODAY', content: input.todayGoal })
      : "THE DEVELOPER'S STATED GOAL FOR TODAY:\nNone stated.";

  return `You are the quality reviewer for a Developer Work Companion, critiquing a daily plan the companion just generated — BEFORE the developer sees it. Judge the plan strictly against the evidence below and decide whether one revision would materially improve it.

${UNTRUSTED_CONTENT_SAFETY_INSTRUCTION}

WHAT TO CHECK THE PLAN FOR:
- Weak or vague planned steps (no concrete output, prompt, or validation).
- Steps that ignore an open blocker or risk that should come first.
- Missing or superficial validation checks.
- Steps that conflict with the progress vs spec (e.g. redoing "done" work, or skipping a "missing"/"blocked" item the goal needs).
- Steps that should be split, clarified, or reordered for priority.
- Overconfident recommendations the evidence does not support.

HOW TO JUDGE:
- Be honest in BOTH directions. If the plan is already sound, return "revisionNeeded": false with an empty or small issues list — do NOT invent problems to look useful.
- Revise only when at least one issue materially weakens the plan. This is the single allowed pass: your output is final, so make the revision complete rather than incremental.

WHAT YOU MAY AND MAY NOT CHANGE:
- You may revise ONLY the planning sections: plannedSteps, decisionsNeedingApproval, notionDailyUpdate, memoryUpdate.
- You may NOT approve anything. Every revised step and decision has "status": "pending_approval" — the developer decides.
- You may NOT rewrite the factual sections (yesterday summary, progress vs spec, advanced items, blockers/risks, evidence, confidence values). They are finished analysis; treat them as ground truth to check the plan against.
- Keep memoryUpdate.date exactly as it is in the guidance. Do not remove evidence or claim progress the guidance does not report.
- Do not give revised steps ids — the system assigns them.

Return ONLY a valid JSON object — no markdown fences, no commentary — with this exact shape ("revisedPlan" present exactly when "revisionNeeded" is true):

{
  "issues": [
    { "targetStepId": "step id when the issue is step-specific (omit otherwise)", "issue": "What is wrong.", "severity": "high | medium | low", "suggestion": "What should change." }
  ],
  "revisionNeeded": true,
  "summary": "One paragraph: your overall judgement of the plan.",
  "confidence": "high | medium | low",
  "revisedPlan": {
    "plannedSteps": [
      { "title": "...", "whyItMatters": "...", "expectedOutput": "...", "cursorPrompt": "Ready-to-paste prompt.", "validationChecklist": ["..."], "relatedSpecItems": ["... (omit if unknown)"], "status": "pending_approval" }
    ],
    "decisionsNeedingApproval": [
      { "decision": "...", "context": "...", "options": ["... (omit if not a fork)"], "recommendedOption": "... (omit if none)", "status": "pending_approval" }
    ],
    "notionDailyUpdate": { "yesterday": "...", "today": "...", "blockers": "...", "decisionsNeeded": "...", "progressVsSpec": "...", "nextCursorPrompt": "..." },
    "memoryUpdate": { "date": "Keep the guidance's memoryUpdate.date.", "dailySummary": "...", "updatedChecklistStatuses": [ { "item": "...", "status": "done | partial | missing | blocked | unclear" } ], "newDecisions": ["..."], "openBlockers": ["..."], "nextActions": ["..."] }
  }
}

REQUIREMENT ALIGNMENT (evidence):
${JSON.stringify(input.requirementAlignment, null, 2)}

GAP REPORT (evidence):
${JSON.stringify(input.gapReport, null, 2)}

${guidanceSection}

${memorySection}

${goalSection}`;
}
