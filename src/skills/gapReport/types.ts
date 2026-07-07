/**
 * Types for the GapReportSkill — the first human-facing output skill.
 *
 * Input is the two upstream knowledge artifacts only. The raw diff is
 * deliberately absent: a gap report must never re-read or re-analyze the diff,
 * regenerate the ChangeExplanation, or redo the RequirementAlignment. It only
 * reframes existing findings into a developer-facing "can I open a PR?" answer.
 */
import type { ChangeExplanation } from '../changeExplanation/index.js';
import type { RequirementAlignment } from '../requirementAlignment/index.js';

/**
 * Overall PR-readiness verdict.
 * - ready          — no meaningful gaps and no major risks.
 * - needs_changes  — fixable gaps or partial items remain.
 * - blocked        — a critical requirement is unimplemented; a PR would be meaningless.
 * - unclear        — not enough evidence to decide.
 */
export type Readiness = 'ready' | 'needs_changes' | 'blocked' | 'unclear';

export interface GapReportInput {
  changeExplanation: ChangeExplanation;
  requirementAlignment: RequirementAlignment;
}

export interface GapReport {
  readiness: Readiness;
  /** What is done — mainly the alignment's satisfied items. */
  completedWork: string[];
  /** What is still missing — mainly the alignment's missing items. */
  remainingGaps: string[];
  /** What is half-done — mainly the alignment's partially-satisfied items. */
  partialItems: string[];
  /** What could not be verified — mainly the alignment's unclear items. */
  unclearItems: string[];
  /** Practical risks of opening a PR in the current state. */
  risks: string[];
  /** Concrete, action-oriented next steps. */
  recommendedNextActions: string[];
  /** A short, direct recommendation. Not a PR description. */
  prRecommendation: string;
}
