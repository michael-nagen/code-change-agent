/**
 * The raw diff in RequirementAlignmentInput is optional fallback context — it
 * must not replace the ChangeExplanation as the primary reasoning artifact.
 *
 * RequirementAlignment is structured data, not markdown or a report.
 * Downstream generators consume this object rather than re-evaluating
 * alignment from scratch.
 */

import type { ChangeExplanation } from '../changeExplanation/index.js';

export interface RequirementAlignmentInput {
  requirementText: string;
  changeExplanation: ChangeExplanation;
  /**
   * Optional fallback context. The skill should consult this only when the
   * ChangeExplanation does not provide sufficient evidence to determine
   * alignment. It must not replace the ChangeExplanation as the primary
   * reasoning artifact.
   */
  rawDiff?: string;
}

export interface RequirementAlignment {
  requirementSummary: string;

  /** Each item cites evidence from the ChangeExplanation. */
  satisfiedItems: string[];

  /** Each item covers what is present and what is still missing. */
  partiallySatisfiedItems: string[];

  missingItems: string[];

  /** Prefer explicit uncertainty here over inventing conclusions. */
  unclearItems: string[];

  /** Covers what was built, what gaps exist, and how confidently this can be determined. */
  overallAssessment: string;

  /**
   * Reflects the quality of available evidence.
   * high   — requirement is clear; ChangeExplanation provides strong evidence.
   * medium — requirement is mostly clear; some assumptions are required.
   * low    — requirement is ambiguous; alignment cannot be confidently determined.
   */
  confidence: 'high' | 'medium' | 'low';
}
