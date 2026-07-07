/**
 * Types for the PRDescriptionSkill — a GitHub-ready PR description output skill.
 *
 * Input is the four upstream artifacts only. The raw diff is deliberately
 * absent: the PR description is assembled from existing findings, never by
 * re-reading or re-analyzing the diff, and never by regenerating or redoing the
 * upstream artifacts.
 */
import type { ChangeExplanation } from '../changeExplanation/index.js';
import type { RequirementAlignment } from '../requirementAlignment/index.js';
import type { GapReport } from '../gapReport/index.js';
import type { FlowArtifact } from '../flowGeneration/index.js';

export interface PRDescriptionInput {
  changeExplanation: ChangeExplanation;
  requirementAlignment: RequirementAlignment;
  gapReport: GapReport;
  flowArtifact: FlowArtifact;
}

export interface PRDescription {
  title: string;
  summary: string;
  /** Capabilities introduced or modified. */
  whatChanged: string[];
  /** Honest per-item requirement coverage (satisfied/partial/missing/unclear). */
  requirementCoverage: string[];
  /** Prose containing the embedded Mermaid flow diagram. */
  featureFlow: string;
  /** Suggested testing — never a claim that tests already passed. */
  testingNotes: string[];
  /** Risks and follow-up actions carried from the gap report. */
  risksAndFollowUps: string[];
}
