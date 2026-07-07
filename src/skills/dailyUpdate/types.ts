/**
 * Types for the DailyUpdateSkill — a human-facing standup-prep output skill.
 *
 * Input is the five upstream knowledge artifacts only. The raw diff is
 * deliberately absent: a daily update must never re-read or re-analyze the diff,
 * regenerate the ChangeExplanation, redo the RequirementAlignment, or produce a
 * new PR description. It only reframes existing findings into a short standup:
 *  - ChangeExplanation    → what was implemented
 *  - RequirementAlignment → what is done / partial / missing / unclear
 *  - GapReport            → readiness, risks, and recommended next actions
 *  - PRDescription        → communication context only, not a source of truth
 *  - FlowArtifact         → help explaining the highlighted topic
 */
import type { ChangeExplanation } from '../changeExplanation/index.js';
import type { RequirementAlignment } from '../requirementAlignment/index.js';
import type { GapReport } from '../gapReport/index.js';
import type { PRDescription } from '../prDescription/index.js';
import type { FlowArtifact } from '../flowGeneration/index.js';

export interface DailyUpdateInput {
  changeExplanation: ChangeExplanation;
  requirementAlignment: RequirementAlignment;
  gapReport: GapReport;
  prDescription: PRDescription;
  flowArtifact: FlowArtifact;
}

/** One meaningful topic the developer can expand on during the standup. */
export interface HighlightedTopic {
  title: string;
  explanation: string;
  whyItMatters: string;
}

export interface DailyUpdate {
  /** One-sentence status summary. */
  headline: string;
  /** What was completed or built — drawn from the implemented change. */
  yesterdaySummary: string[];
  /** Next steps — drawn from the gap report's recommended next actions. */
  todaySuggestions: string[];
  /** Honest risks/gaps/unclear items from the gap report and alignment. */
  blockersOrRisks: string[];
  highlightedTopic: HighlightedTopic;
  /** A natural, ready-to-say update (~30–60 seconds). */
  spokenVersion: string;
}
