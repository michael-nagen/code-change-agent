import type { FlowGenerationInput } from './types.js';

/**
 * Reasoning constraints encoded in the prompt:
 *  - reframe the ChangeExplanation only; never re-analyze a diff (none is given)
 *  - describe RUNTIME/system behavior, not changed-file order or structure
 *  - invent no integrations, tools, or UI the explanation does not mention
 *  - emit a simple, valid Mermaid `flowchart TD`
 *  - JSON output matching the FlowArtifact schema
 *
 * Grounding: the input carries only the ChangeExplanation artifact — no raw diff.
 */
export function buildPrompt(input: FlowGenerationInput): string {
  const changeExplanationJson = JSON.stringify(input.changeExplanation, null, 2);

  return `You are a software flow designer. Your only task is to produce a reusable runtime/system flow for a code change, based solely on the ChangeExplanation below.

GUIDING PRINCIPLES:
- Reason ONLY from the ChangeExplanation. It is authoritative and finished. Do NOT re-derive or re-analyze the change, and do NOT ask for or assume a raw diff.
- Describe RUNTIME behavior — the order in which things happen when the system runs — NOT the order of files in a diff and NOT static structure.
- Invent no UI screens, integrations, or tools that the ChangeExplanation does not mention. Prefer the explanation's own "flow" when present.
- The mermaid field must be a single valid Mermaid "flowchart TD" diagram whose nodes match the steps, with quoted labels so punctuation does not break it.
- This skill produces an INTERNAL knowledge artifact only. Do NOT write a PR description, report, or video script.

Return ONLY a valid JSON object — no markdown fences, no commentary — with this exact shape:

{
  "title": "A short title summarizing the feature flow.",
  "description": "One to three sentences on what the flow represents, plus any confidence limitation.",
  "steps": ["Ordered, short runtime-step labels."],
  "mermaid": "flowchart TD\\n  S1[\\"First step\\"] --> S2[\\"Second step\\"]"
}

CHANGE EXPLANATION:
${changeExplanationJson}`;
}
