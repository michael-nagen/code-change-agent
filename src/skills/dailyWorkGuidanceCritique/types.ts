/**
 * Types for the GuidanceCritiqueSkill — the bounded self-critique pass that
 * runs ONCE after the Daily Work Guidance plan is generated and before the
 * user sees it.
 *
 * The critic checks the proposed plan against the run's own evidence (progress
 * vs spec, blockers, gap report, requirement alignment, prior memory, the
 * stated goal) and either signs off or proposes ONE revision of the planning
 * sections. It has no authority: it cannot approve anything, cannot alter the
 * factual sections, and its revised steps re-enter as `pending_approval` for
 * the user to judge. The deterministic merge in the analysis layer enforces
 * all of that; the parser fails closed on any attempt to violate it.
 */
import type {
  Confidence,
  DailyWorkGuidance,
  GuidanceCritiqueIssue,
  MemoryUpdate,
  NotionDailyUpdate,
} from '../dailyWorkGuidance/index.js';
import type { RequirementAlignment } from '../requirementAlignment/index.js';
import type { GapReport } from '../gapReport/index.js';

export interface GuidanceCritiqueInput {
  /** The freshly generated guidance (all items still pending approval). */
  guidance: DailyWorkGuidance;
  requirementAlignment: RequirementAlignment;
  gapReport: GapReport;
  /** Prior project memory, when available. */
  previousProgressMemory?: string;
  /** The user's stated goal for today, when given. */
  todayGoal?: string;
}

/** A re-planned step; the merge assigns ids, so the critic supplies none. */
export interface CritiqueRevisedStep {
  title: string;
  whyItMatters: string;
  expectedOutput: string;
  cursorPrompt: string;
  validationChecklist: string[];
  relatedSpecItems?: string[];
  /** Always pending — the parser rejects any other value. */
  status: 'pending_approval';
}

/** A revised open decision; always pending, like the steps. */
export interface CritiqueRevisedDecision {
  decision: string;
  context: string;
  options?: string[];
  recommendedOption?: string;
  status: 'pending_approval';
}

/** The planning sections a revision may replace — nothing else. */
export interface CritiqueRevisedPlan {
  plannedSteps: CritiqueRevisedStep[];
  /** When present, replaces the open discussion/approval points. */
  decisionsNeedingApproval?: CritiqueRevisedDecision[];
  notionDailyUpdate: NotionDailyUpdate;
  memoryUpdate: MemoryUpdate;
}

/**
 * The critic's verdict. `revisedPlan` must be present exactly when
 * `revisionNeeded` is true — the parser rejects an inconsistent pair.
 */
export interface GuidancePlanCritique {
  issues: GuidanceCritiqueIssue[];
  revisionNeeded: boolean;
  summary: string;
  confidence: Confidence;
  revisedPlan?: CritiqueRevisedPlan;
}
