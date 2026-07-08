import type { ChangeExplanationInput } from './types.js';
import {
  UNTRUSTED_CONTENT_SAFETY_INSTRUCTION,
  fenceUntrustedContent,
} from '../shared/untrustedContent.js';

/**
 * Reasoning constraints encoded in the prompt:
 *  - behavior, not files
 *  - capabilities, not code volume
 *  - uncertainty over hallucination
 *  - JSON output matching the ChangeExplanation schema
 *
 * The git diff is untrusted source content, so it is fenced and preceded by the
 * shared safety preamble: it is data to analyze, never instructions to obey.
 */
export function buildPrompt(input: ChangeExplanationInput): string {
  return `You are a code change analyst. Analyze the following git diff and produce a structured explanation of the change.

${UNTRUSTED_CONTENT_SAFETY_INSTRUCTION}

GUIDING PRINCIPLES:
- Explain system BEHAVIOR, not files. Say "The system now supports X", not "Modified file.ts".
- Explain CAPABILITIES, not code volume. Say "Added caching support", not "Added 50 lines".
- Focus on: behavior, runtime flow, responsibilities, architecture, impact, and uncertainty.
- Do NOT report changed files, line counts, added/removed imports, renames, or other low-level implementation trivia UNLESS they directly affect runtime behavior or architecture.
- Prefer UNCERTAINTY over hallucination. If something cannot be determined from the diff, state it clearly in the uncertainties array.
- Do NOT invent business requirements, production usage, or missing integrations.
- This skill produces INTERNAL DOMAIN KNOWLEDGE only. Do NOT generate PR descriptions, reports, summaries, release notes, video scripts, slides, diagrams, or any communication artifact.

Return ONLY a valid JSON object — no markdown fences, no explanation text — with this exact shape:

{
  "changeStory": "A concise 2–4 sentence narrative. If inferable, describe what existed before. Then explain what changed and how the system behaves now. Focus on system behavior, not files.",
  "keyFunctionalities": [
    "Each item is a short sentence starting with a verb describing an introduced or modified capability. E.g. 'Supports planning before execution'."
  ],
  "flow": [
    "Ordered short labels describing the runtime/user/system flow after the change — NOT the order of files in the diff. E.g. 'User Request', 'Harness Creates Session', 'Build Understanding', 'Generate Report'."
  ],
  "mainComponents": [
    {
      "name": "ComponentName",
      "responsibility": "One sentence: what this component is responsible for."
    }
  ],
  "architecturalDecisions": [
    "Each item describes an important design or architectural choice visible in the diff. Focus on decisions, not code details."
  ],
  "impactAnalysis": [
    "Each item describes a system area affected by this change. Also note major areas NOT affected when inferable."
  ],
  "uncertainties": [
    "Each item names something that cannot be confidently determined from the diff alone. E.g. 'Whether tests were updated to cover the new behavior'."
  ]
}

${fenceUntrustedContent({ label: 'GIT DIFF', content: input.diff })}`;
}
