/**
 * Types for the ArtifactEditSkill.
 *
 * This skill EDITS one existing, already-generated text artifact through a
 * conversation. It does NOT analyze a diff, does NOT run the full workflow, and
 * does NOT generate missing artifacts. It is the conversational counterpart to
 * the generation skills: it reasons over the selected artifact (plus read-only
 * session context) and returns an updated version of that same artifact.
 *
 * Only text-facing generated artifacts are editable in v1:
 *   - prDescription / PR Draft
 *   - dailyUpdate   / Daily Prep
 *   - videoScript   / Walkthrough Script
 */
import type { ChangeExplanation } from '../changeExplanation/index.js';
import type { RequirementAlignment } from '../requirementAlignment/index.js';
import type { GapReport } from '../gapReport/index.js';
import type { FlowArtifact } from '../flowGeneration/index.js';
import type { PRDescription } from '../prDescription/index.js';
import type { VideoScript } from '../videoScript/index.js';
import type { DailyUpdate } from '../dailyUpdate/index.js';

/** The artifacts that may be edited via chat in v1. */
export type EditableArtifactKey = 'prDescription' | 'dailyUpdate' | 'videoScript';

/** The concrete artifact shapes addressable by an EditableArtifactKey. */
export type EditableArtifact = PRDescription | DailyUpdate | VideoScript;

/** One turn of the side-chat conversation. */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Read-only context the edit can consult. It deliberately carries NO raw diff:
 * editing must never re-analyze the original change. Any subset may be present.
 */
export interface ArtifactEditSessionContext {
  changeExplanation?: ChangeExplanation;
  requirementAlignment?: RequirementAlignment;
  gapReport?: GapReport;
  flowArtifact?: FlowArtifact;
  prDescription?: PRDescription;
  videoScript?: VideoScript;
  dailyUpdate?: DailyUpdate;
}

export interface ArtifactEditInput {
  selectedArtifactKey: EditableArtifactKey;
  /** The current value of the selected artifact — the only thing that is edited. */
  selectedArtifact: EditableArtifact;
  /** The user's edit request. */
  userMessage: string;
  /** Prior turns of the conversation, if any. */
  conversationHistory?: ChatMessage[];
  /** Other session artifacts, available for reference only. Never includes rawDiff. */
  sessionContext: ArtifactEditSessionContext;
}

export interface ArtifactEditResult {
  /** A short, user-facing reply describing what changed (or why nothing did). */
  assistantMessage: string;
  /** The updated artifact. Matches the schema of `selectedArtifactKey`. */
  updatedArtifact: EditableArtifact;
  /** A one-line summary of the edit (or "No changes made."). */
  changeSummary: string;
}
