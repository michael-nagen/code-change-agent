/**
 * Types for the DailyWorkGuidanceSkill — the Developer Work Companion's
 * "how do I work today?" artifact.
 *
 * The loop this artifact serves:
 *   yesterday's work → compare against the spec/checklist → identify progress,
 *   blockers, and decisions → recommend today's plan (kept open for approval) →
 *   produce a fixed Notion-ready daily update → suggest a structured memory
 *   update.
 *
 * Input is the spec/checklist plus the upstream knowledge artifacts, with
 * optional previous-progress memory and an optional goal for the day. The raw
 * diff is deliberately absent: this skill reasons over existing findings only:
 *  - ChangeExplanation    → what was implemented in the latest ("yesterday's") work
 *  - RequirementAlignment → done / partial / missing / unclear vs the spec
 *  - GapReport            → readiness, risks, and recommended next actions
 *  - FlowArtifact         → runtime flow, to ground the plan and prompts
 *
 * A guiding principle of this artifact: the plan is NOT final. Every planned
 * step and every decision is surfaced as `pending_approval` so the developer
 * stays in control.
 */
import type { ChangeExplanation } from '../changeExplanation/index.js';
import type { RequirementAlignment } from '../requirementAlignment/index.js';
import type { GapReport } from '../gapReport/index.js';
import type { FlowArtifact } from '../flowGeneration/index.js';

export interface DailyWorkGuidanceInput {
  /** The original spec or checklist the work is measured against. */
  specOrChecklist: string;
  /** Today's date (YYYY-MM-DD), stamped onto the memory update. */
  date: string;
  changeExplanation: ChangeExplanation;
  requirementAlignment: RequirementAlignment;
  gapReport: GapReport;
  flowArtifact: FlowArtifact;
  /** Previous progress memory from an earlier session, when available. */
  previousProgressMemory?: string;
  /** An optional goal for today, e.g. "I want to finish this project today". */
  todayGoal?: string;
}

/**
 * How a single spec/checklist item stands after the latest work.
 * - done      — fully implemented and verifiable in the analysis.
 * - partial   — started or half-implemented.
 * - missing   — not addressed by the latest work.
 * - blocked   — cannot proceed due to a dependency, risk, or open decision.
 * - unclear   — the analysis does not provide enough evidence to classify.
 */
export type ProgressStatus = 'done' | 'partial' | 'missing' | 'blocked' | 'unclear';

/** The model's confidence in a classification. */
export type Confidence = 'high' | 'medium' | 'low';

/** Every planned step and open decision is surfaced as pending approval. */
export type ApprovalStatus = 'pending_approval';

/** One spec/checklist item compared against the latest work. */
export interface ProgressItem {
  /** The spec/checklist item, referenced as closely as the spec allows. */
  item: string;
  /** The status before yesterday's work, when previous memory makes it known. */
  previousStatus?: ProgressStatus;
  /** What yesterday's work changed for this item. */
  whatChanged: string;
  /** The status after the latest work. */
  newStatus: ProgressStatus;
  /** Why it was classified this way, grounded in the analysis artifacts. */
  evidence: string;
  confidence: Confidence;
}

/** A spec/checklist item that moved forward as a result of yesterday's work. */
export interface AdvancedChecklistItem {
  item: string;
  previousStatus: ProgressStatus;
  newStatus: ProgressStatus;
  /** What specifically advanced. */
  whatAdvanced: string;
  evidence: string;
}

/** A blocker or risk that stands between the developer and the goal. */
export interface BlockerOrRisk {
  title: string;
  description: string;
  whyItMatters: string;
  /** The action or decision required to clear it. */
  requiredAction: string;
  /** Optional severity, e.g. "high" | "medium" | "low", when useful. */
  severity?: string;
}

/** A decision the developer must approve before the plan is treated as final. */
export interface DecisionNeedingApproval {
  decision: string;
  context: string;
  /** Options to choose between, when the decision is a fork. */
  options?: string[];
  /** The model's recommendation among the options, if it has one. */
  recommendedOption?: string;
  status: ApprovalStatus;
}

/**
 * A single recommended step for today. It is intentionally NOT final: its
 * `status` is always `pending_approval` so the developer can accept, reject, or
 * refine it before acting.
 */
export interface PlannedStep {
  /** Stable-within-the-artifact id, e.g. "step-1". */
  id: string;
  title: string;
  whyItMatters: string;
  /** What finishing this step should produce. */
  expectedOutput: string;
  /** A ready-to-paste Cursor/Claude prompt for this step. */
  cursorPrompt: string;
  /** Checks that confirm this step is actually done. */
  validationChecklist: string[];
  /** Spec/checklist items this step advances, when known. */
  relatedSpecItems?: string[];
  status: ApprovalStatus;
}

/**
 * A fixed-format daily update that renders cleanly into a Notion block and is
 * easy to copy. Each field is a ready-to-read section of the update.
 */
export interface NotionDailyUpdate {
  yesterday: string;
  today: string;
  blockers: string;
  decisionsNeeded: string;
  progressVsSpec: string;
  nextCursorPrompt: string;
}

/** A single checklist item's status, for persisting into memory. */
export interface ChecklistStatusEntry {
  item: string;
  status: ProgressStatus;
}

/**
 * A structured snapshot of progress meant to be saved back into memory and
 * reused as `previousProgressMemory` on a later run.
 */
export interface MemoryUpdate {
  /** The date this snapshot represents (YYYY-MM-DD). */
  date: string;
  /** One-paragraph summary of the day worth persisting. */
  dailySummary: string;
  /** The current status of each tracked checklist item. */
  updatedChecklistStatuses: ChecklistStatusEntry[];
  /** Decisions surfaced today that still need resolution. */
  newDecisions: string[];
  /** Blockers still open at the end of the day. */
  openBlockers: string[];
  /** The next actions to carry into tomorrow. */
  nextActions: string[];
}

export interface DailyWorkGuidance {
  /** What was done yesterday, drawn from the latest work analysis. */
  yesterdaySummary: string;
  /** Each spec/checklist item compared against yesterday's work. */
  progressVsSpec: ProgressItem[];
  /** The items that explicitly moved forward yesterday. */
  advancedChecklistItems: AdvancedChecklistItem[];
  /** Top-level blockers and risks, not buried inside the memory update. */
  blockersAndRisks: BlockerOrRisk[];
  /** Decisions the developer must approve before the plan is final. */
  decisionsNeedingApproval: DecisionNeedingApproval[];
  /** Today's recommended steps — each open for approval/discussion. */
  plannedSteps: PlannedStep[];
  /** A fixed-format, copyable Notion-ready daily update. */
  notionDailyUpdate: NotionDailyUpdate;
  memoryUpdate: MemoryUpdate;
}
