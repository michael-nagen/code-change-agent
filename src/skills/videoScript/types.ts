/**
 * Types for the VideoScriptSkill — a human-facing walkthrough output skill.
 *
 * Input is the four upstream knowledge artifacts only. The raw diff is
 * deliberately absent: a video script must never re-read or re-analyze the diff,
 * regenerate the ChangeExplanation, or redo the RequirementAlignment. It only
 * reframes existing findings into a short developer walkthrough script:
 *  - ChangeExplanation  → what changed
 *  - RequirementAlignment → whether it matches the requirement
 *  - GapReport          → what remains / what needs attention
 *  - FlowArtifact       → guidance for visual cues
 */
import type { ChangeExplanation } from '../changeExplanation/index.js';
import type { RequirementAlignment } from '../requirementAlignment/index.js';
import type { GapReport } from '../gapReport/index.js';
import type { FlowArtifact } from '../flowGeneration/index.js';

export interface VideoScriptInput {
  changeExplanation: ChangeExplanation;
  requirementAlignment: RequirementAlignment;
  gapReport: GapReport;
  flowArtifact: FlowArtifact;
}

/** A single narrated segment of the walkthrough. */
export interface VideoScriptSection {
  /** A short heading for the segment. */
  title: string;
  /** What the presenter says — spoken, concise, developer-facing. */
  narration: string;
  /** What to show on screen while narrating — guided by the FlowArtifact. */
  visualCue: string;
}

export interface VideoScript {
  /** A short title for the walkthrough. */
  title: string;
  /** Who the walkthrough is for. */
  targetAudience: string;
  /** A rough spoken duration, kept to a short (~1–3 minute) walkthrough. */
  estimatedDuration: string;
  /** Ordered narrated segments. */
  sections: VideoScriptSection[];
  /** The handful of points a viewer should remember. */
  keyTakeaways: string[];
}
