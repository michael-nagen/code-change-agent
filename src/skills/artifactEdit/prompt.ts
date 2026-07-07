import type {
  ArtifactEditInput,
  ArtifactEditSessionContext,
  ChatMessage,
  EditableArtifactKey,
} from './types.js';

/** Product-facing labels, matching the workspace card labels. */
const LABELS: Record<EditableArtifactKey, string> = {
  prDescription: 'PR Draft',
  dailyUpdate: 'Daily Prep',
  videoScript: 'Walkthrough Script',
};

/**
 * The exact JSON shape the `updatedArtifact` must take, per artifact key. These
 * mirror the schemas enforced by each artifact's own parser, so a round-tripped
 * edit re-validates cleanly.
 */
const ARTIFACT_SCHEMAS: Record<EditableArtifactKey, string> = {
  prDescription: `{
    "title": "string",
    "summary": "string",
    "whatChanged": ["string"],
    "requirementCoverage": ["string"],
    "featureFlow": "string (may contain a fenced mermaid block)",
    "testingNotes": ["string"],
    "risksAndFollowUps": ["string"]
  }`,
  dailyUpdate: `{
    "headline": "string",
    "yesterdaySummary": ["string"],
    "todaySuggestions": ["string"],
    "blockersOrRisks": ["string"],
    "highlightedTopic": { "title": "string", "explanation": "string", "whyItMatters": "string" },
    "spokenVersion": "string"
  }`,
  videoScript: `{
    "title": "string",
    "targetAudience": "string",
    "estimatedDuration": "string",
    "sections": [ { "title": "string", "narration": "string", "visualCue": "string" } ],
    "keyTakeaways": ["string"]
  }`,
};

/** Order in which reference artifacts are listed (excluding the selected one). */
const CONTEXT_ORDER: readonly (keyof ArtifactEditSessionContext)[] = [
  'changeExplanation',
  'requirementAlignment',
  'gapReport',
  'flowArtifact',
  'prDescription',
  'videoScript',
  'dailyUpdate',
];

function buildContextSection(
  selectedKey: EditableArtifactKey,
  context: ArtifactEditSessionContext,
  label: string,
): string {
  const parts: string[] = [];
  for (const key of CONTEXT_ORDER) {
    if (key === selectedKey) continue;
    const value = context[key];
    if (value === undefined) continue;
    parts.push(`${key.toUpperCase()}:\n${JSON.stringify(value, null, 2)}`);
  }
  if (parts.length === 0) {
    return 'SESSION CONTEXT: (no additional artifacts are available)';
  }
  return `SESSION CONTEXT (read-only reference — do NOT edit or output these; use them only to inform edits to the ${label}):\n\n${parts.join('\n\n')}`;
}

function buildHistorySection(history: ChatMessage[] | undefined): string {
  if (history === undefined || history.length === 0) {
    return '';
  }
  const lines = history.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
  return `CONVERSATION SO FAR:\n${lines}\n\n`;
}

/**
 * Reasoning constraints encoded in the prompt:
 *  - edit ONLY the selected artifact; never touch or regenerate the others
 *  - work from the provided artifacts only; never re-analyze a diff
 *  - keep the exact JSON schema of the selected artifact
 *  - if the request is unrelated/unsatisfiable, return the artifact unchanged
 *
 * Grounding: the input carries no raw diff, and this builder never emits one.
 */
export function buildPrompt(input: ArtifactEditInput): string {
  const label = LABELS[input.selectedArtifactKey];
  const selectedJson = JSON.stringify(input.selectedArtifact, null, 2);
  const contextSection = buildContextSection(
    input.selectedArtifactKey,
    input.sessionContext,
    label,
  );
  const historySection = buildHistorySection(input.conversationHistory);
  const schema = ARTIFACT_SCHEMAS[input.selectedArtifactKey];

  return `You are an editing assistant helping a developer refine ONE already-generated artifact: the ${label}.

GUIDING PRINCIPLES:
- Edit ONLY the ${label}. Never modify, regenerate, or output any other artifact.
- Work ONLY from the artifacts provided below. Do NOT re-analyze the change, and do NOT ask for or assume a raw diff.
- Preserve the EXACT JSON structure of the current ${label}. Keep every field; change only what the user's request implies.
- Make the smallest change that satisfies the request. Do not invent facts, requirements, test results, or production usage.
- If the user's request is unrelated to the ${label}, or cannot be satisfied from the available information, return the current ${label} UNCHANGED in "updatedArtifact" and explain the limitation in "assistantMessage".
- Be honest: never claim to have changed something you did not change.

CURRENT ${label} (the ONLY artifact you may edit):
${selectedJson}

${contextSection}

${historySection}USER REQUEST:
${input.userMessage}

Return ONLY a valid JSON object — no markdown fences, no commentary — with this exact shape:

{
  "assistantMessage": "A short reply to the user describing what you changed, or why nothing changed.",
  "changeSummary": "One short sentence summarizing the edit, or 'No changes made.' if the artifact is unchanged.",
  "updatedArtifact": ${schema}
}

The "updatedArtifact" MUST use exactly the same JSON structure as the CURRENT ${label} shown above.`;
}
