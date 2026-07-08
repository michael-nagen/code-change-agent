import type { WeeklyReviewInput } from './types.js';
import {
  UNTRUSTED_CONTENT_SAFETY_INSTRUCTION,
  fenceUntrustedContent,
  renderConnectedSourceContextSection,
} from '../shared/untrustedContent.js';

/**
 * Reasoning constraints encoded in the prompt:
 *  - SYNTHESIZE the week from the current change plus the available upstream
 *    artifacts and project memory; this is the higher-level "what happened this
 *    week and why it matters" artifact, not a rehash of any single one
 *  - use each artifact by role: TechnicalChangeBrief → technical changes;
 *    DemoPrepLoop → demo/video story, what to show vs say; DailyWorkGuidance →
 *    daily progress + next steps; previous memory → prior progress/decisions/
 *    blockers across runs
 *  - the current run's explicit inputs are the source of truth; memory is
 *    supporting context and must never override them. Surface conflicts between
 *    memory and the current spec/diff instead of silently merging them
 *  - never invent file paths; tag technical items confirmed vs inferred and only
 *    list real paths under importantFilesOrModules
 *  - decisions are never pre-approved: status is active/open/superseded only
 *  - record every unavailable input in status.missingInputs and lower the
 *    affected confidence; if the demo prep loop is missing, keep the demo/video
 *    story but lower confidence
 *  - JSON output matching the WeeklyReview schema
 */
export function buildPrompt(input: WeeklyReviewInput): string {
  const changeExplanationJson = JSON.stringify(input.changeExplanation, null, 2);
  const requirementAlignmentJson = JSON.stringify(input.requirementAlignment, null, 2);

  const section = (value: unknown, missingNote: string): string =>
    value !== undefined ? JSON.stringify(value, null, 2) : missingNote;

  const gapReportSection = section(
    input.gapReport,
    'Not available — the gap report was not generated for this analysis.',
  );
  const flowArtifactSection = section(
    input.flowArtifact,
    'Not available — the flow artifact was not generated for this analysis.',
  );
  const dailyWorkGuidanceSection = section(
    input.dailyWorkGuidance,
    'Not available — daily work guidance was not generated for this analysis.',
  );
  const technicalChangeBriefSection = section(
    input.technicalChangeBrief,
    'Not available — the technical change brief was not generated (lower technical confidence and note it in missingInputs).',
  );
  const demoPrepLoopSection = section(
    input.demoPrepLoop,
    'Not available — the demo prep loop was not generated (keep a demo/video story but LOWER its confidence and note it in missingInputs).',
  );
  const previousProgressMemorySection =
    input.previousProgressMemory !== undefined && input.previousProgressMemory.trim() !== ''
      ? fenceUntrustedContent({
          label: 'PREVIOUS PROGRESS MEMORY',
          content: input.previousProgressMemory,
        })
      : 'PREVIOUS PROGRESS MEMORY:\nNone provided — treat this as the first tracked week; do not invent prior progress.';

  const reviewPeriodLabel =
    input.reviewPeriodLabel !== undefined && input.reviewPeriodLabel.trim() !== ''
      ? input.reviewPeriodLabel
      : `Week ending ${input.generatedAt.slice(0, 10)}`;

  const userPreferencesSection =
    input.userPromptPreferences !== undefined && input.userPromptPreferences.trim() !== ''
      ? `\n\n${input.userPromptPreferences}`
      : '';

  const connectedSourceSection = renderConnectedSourceContextSection(input.connectedSourceContext);

  return `You are a Developer Work Companion writing a SHORT, mentor/manager-ready WEEKLY REVIEW: a clean update ready to send, not a full dump of the system. Use only the inputs below.

${UNTRUSTED_CONTENT_SAFETY_INSTRUCTION}

WHAT THIS IS:
- A sharp weekly update focused on: what shipped, what was verified, what is still a risk/gap, what is next, and the single strongest demo/mentor sentence.

WHAT THIS IS NOT:
- NOT a re-enumeration of every technical detail. Do NOT restate the whole Technical Change Brief or the whole Demo Prep Loop. SYNTHESIZE across them.

GUIDING PRINCIPLES:
- SYNTHESIZE; do not merely restate one artifact. Roles: TECHNICAL CHANGE BRIEF → "What Changed Technically"; DEMO PREP LOOP → the "Demo / Video Story" (strongest story, what to show vs say, structure, key files/screens, product sentence); DAILY WORK GUIDANCE → daily progress and next steps; PREVIOUS PROGRESS MEMORY → what was already done, decisions, blockers, and next actions across earlier runs.
- Keep it CONCISE and high-signal. Prefer fewer strong items over many weak ones; one sentence per item. Keep each list to roughly the 3–5 most important items and drop trivial ones. executiveSummary is at most ~3 sentences.
- Be precise about proof: state what was actually VERIFIED (and how) versus what is only claimed or MOCKED; do not overclaim features.
- suggestedWeeklyUpdate is the MOST IMPORTANT output — it is what gets sent to Notion/Telegram. Make it the highest-quality, send-ready text: concrete, synthesized, and free of filler.
- The CURRENT run's explicit inputs (diff, spec, this-run artifacts) are the SOURCE OF TRUTH. Memory is supporting context only and must never override them. If memory conflicts with the current spec/diff, SURFACE the conflict (in the relevant item's notes or as a blocker with status "needs_review") rather than silently merging.
- Record every unavailable input in status.missingInputs and lower the affected confidence. If the demo prep loop is missing, still produce a demo/video story but keep it lower-confidence.
- Never invent file paths. Tag each technical item evidence "confirmed" or "inferred"; only list real, evidenced paths under importantFilesOrModules and keyFilesOrScreens.
- Decisions are NEVER pre-approved: keyDecisions[].status is one of active | open | superseded.
- Every progressAgainstSpec item and key decision must state its "source" (memory | daily | technical_brief | demo_prep | current_run | inferred).
- Use EXACTLY this generatedAt: ${input.generatedAt}. Use this reviewPeriodLabel unless the inputs clearly imply a better one: ${reviewPeriodLabel}. status is always "draft".

Return ONLY a valid JSON object — no markdown fences, no commentary — with this exact shape:

{
  "status": { "status": "draft", "confidence": "high | medium | low", "missingInputs": ["Names of unavailable inputs."], "reviewPeriodLabel": "${reviewPeriodLabel}", "generatedAt": "${input.generatedAt}" },
  "executiveSummary": "What was built, why it matters, current state, and the main next step.",
  "progressAgainstSpec": [
    { "title": "A spec/checklist item.", "status": "done | partial | blocked | unclear | not_started", "evidence": "Why, grounded in the inputs.", "notes": "Nuance or a surfaced memory/spec conflict.", "source": "memory | daily | technical_brief | demo_prep | current_run | inferred" }
  ],
  "whatChangedTechnically": {
    "schemaOrDataChanges": [ { "description": "...", "filePath": "only if a real path is visible", "evidence": "confirmed | inferred" } ],
    "modelOrTypeChanges": [ { "description": "...", "evidence": "confirmed | inferred" } ],
    "workflowOrRuntimeChanges": [ { "description": "...", "evidence": "confirmed | inferred" } ],
    "uiChanges": [ { "description": "...", "evidence": "confirmed | inferred" } ],
    "toolsOrSkillsAdded": [ { "description": "...", "evidence": "confirmed | inferred" } ],
    "importantFilesOrModules": ["Only real, evidenced paths/modules."]
  },
  "keyDecisions": [
    { "decision": "...", "why": "...", "impact": "...", "status": "active | open | superseded", "source": "..." }
  ],
  "blockersAndRisks": [
    { "title": "...", "whyItMatters": "...", "status": "open | resolved | needs_review", "suggestedNextAction": "..." }
  ],
  "demoVideoStory": {
    "strongestStory": "The single strongest story of the week.",
    "whatToShow": ["Concrete things to show on screen."],
    "whatToSay": ["Things to say verbally, not show."],
    "whatToSkip": ["Things to skip to keep it tight."],
    "recommendedStructure": [ { "title": "Segment title.", "durationLabel": "~1 min", "focus": "What this segment covers." } ],
    "keyFilesOrScreens": ["Real files/screens worth showing."],
    "strongestProductSentence": "One crisp product sentence."
  },
  "reviewTalkingPoints": ["I built…", "The important design decision was…", "The current limitation is…", "Next I will…"],
  "suggestedWeeklyUpdate": {
    "thisWeek": "…",
    "technicalProgress": "…",
    "demoProductProgress": "…",
    "blockers": "…",
    "nextWeek": "…"
  },
  "nextWeekPlan": ["An ordered, practical thing to do next week."],
  "memoryUpdateProposal": {
    "latestWeeklySummary": "One-paragraph summary to persist.",
    "updatedChecklistStatuses": [ { "item": "A spec item.", "status": "done | partial | blocked | unclear | not_started" } ],
    "newDecisions": ["Decisions surfaced this week."],
    "updatedBlockers": ["Blockers still open."],
    "nextActions": ["Next actions to carry forward."],
    "demoStorySummary": "One-line summary of the demo story.",
    "filesWorthShowing": ["Real files worth showing."]
  }
}

${fenceUntrustedContent({ label: 'SPEC / REQUIREMENT', content: input.requirementText })}${userPreferencesSection}

${previousProgressMemorySection}

CHANGE EXPLANATION:
${changeExplanationJson}

REQUIREMENT ALIGNMENT:
${requirementAlignmentJson}

GAP REPORT:
${gapReportSection}

FLOW ARTIFACT:
${flowArtifactSection}

DAILY WORK GUIDANCE:
${dailyWorkGuidanceSection}

TECHNICAL CHANGE BRIEF (use heavily for technical changes):
${technicalChangeBriefSection}

DEMO PREP LOOP (use heavily for the demo/video story):
${demoPrepLoopSection}

${fenceUntrustedContent({ label: 'RAW DIFF', content: input.rawDiff })}${connectedSourceSection}`;
}
