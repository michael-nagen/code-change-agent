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
  /**
   * A pre-rendered block of the developer's personal working / prompt
   * preferences (format, tone, daily-update and Cursor-prompt style). It shapes
   * how the output READS only — it never overrides factual claims grounded in
   * the spec or the upstream analysis.
   */
  userPromptPreferences?: string;
  /**
   * A pre-rendered block of connected source context (GitHub/Notion/memory)
   * assembled from the session's project context. SUPPORTING context only — the
   * spec/checklist and upstream analysis remain the source of truth, and it must
   * never override or fabricate factual claims.
   */
  connectedSourceContext?: string;
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

/**
 * The lifecycle of a recommended item. The skill ALWAYS emits
 * `pending_approval` (the parser enforces this); the other statuses are only
 * ever set by the user's explicit decisions applied after generation.
 */
export type ApprovalStatus = 'pending_approval' | 'approved' | 'rejected' | 'edited' | 'deferred';

/**
 * Where the guidance loop stands.
 * - planning — the proposed plan awaits the user's decisions.
 * - revised_plan_pending_approval — the model re-planned after the user
 *   rejected/edited items; the revised steps await approval.
 * - approved_plan — the user has decided on every pending item.
 */
export type GuidanceLoopStage = 'planning' | 'revised_plan_pending_approval' | 'approved_plan';

/** Loop-level review state, advanced only by applied user decisions. */
export type GuidanceLoopOverallStatus = 'pending_user_review' | 'approved';

/**
 * The approval loop's state machine. The skill never sets this — the parser
 * initializes it deterministically and it advances only when the user's
 * decisions are applied.
 */
export interface GuidanceLoopStatus {
  currentStage: GuidanceLoopStage;
  overallStatus: GuidanceLoopOverallStatus;
  /** ISO timestamp of the last applied decision batch, once one exists. */
  decidedAt?: string;
  /** The model's one-paragraph summary of its last re-plan, once one exists. */
  lastRevisionSummary?: string;
}

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
  /** The user's note/reason recorded with their decision, when they gave one. */
  note?: string;
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
  /** The user's note/reason recorded with their decision, when they gave one. */
  note?: string;
  /**
   * For a model-revised step: the id of the rejected/edited step it replaces,
   * or "new" when the revision introduced it. Absent on original steps.
   */
  respondsTo?: string;
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

/** One problem the self-critique found with the proposed plan. */
export interface GuidanceCritiqueIssue {
  /** The planned step the issue concerns, when it is step-specific. */
  targetStepId?: string;
  issue: string;
  severity: 'high' | 'medium' | 'low';
  /** What should change to address it. */
  suggestion: string;
}

/**
 * The result of the bounded self-critique pass that runs once after the plan
 * is generated and before it is shown to the user. It is a quality review of
 * the PLAN only: it never approves anything, never alters factual sections,
 * and a revision (when applied) still returns every step pending approval.
 */
export interface GuidanceSelfCritique {
  issues: GuidanceCritiqueIssue[];
  /** Whether the one allowed revision pass was applied to the plan. */
  revisionApplied: boolean;
  summary: string;
  confidence: Confidence;
  /** ISO timestamp of the critique pass. */
  checkedAt: string;
}

/**
 * Daily Work Guidance is a SHORT WORK CHECKPOINT, not a full report:
 *  - `headline`           — one line: where the work stands today.
 *  - `whatChanged`        — one sentence per topic (what we did).
 *  - `nextActions`        — one sentence per action (what to do next).
 *  - `blockersOrDecisions`— only the important blockers/decisions (may be empty).
 *
 * `notionDailyUpdate` and `memoryUpdate` are retained as the structured sources
 * for the two footer actions (Send to Notion / Save to memory); they are derived
 * from the checkpoint content, not a second report to read.
 *
 * The remaining approval-loop fields are DORMANT: the checkpoint no longer
 * generates or renders them, but they stay optional so the (now unused)
 * approval-loop code keeps compiling until it is removed in a follow-up.
 */
export interface DailyWorkGuidance {
  /** One line: where the work stands today. */
  headline: string;
  /** What we did — one sentence per topic. No trivial items. */
  whatChanged: string[];
  /** What to do next — one sentence per action. */
  nextActions: string[];
  /** Only the important blockers or decisions; empty when there are none. */
  blockersOrDecisions: string[];
  /** A fixed-format, copyable Notion-ready daily update (footer: Send to Notion). */
  notionDailyUpdate: NotionDailyUpdate;
  /** The savable memory snapshot (footer: Save to memory). */
  memoryUpdate: MemoryUpdate;

  // --- Dormant approval-loop fields (no longer generated or shown) ---
  /** @deprecated Dormant approval-loop state. */
  loopStatus?: GuidanceLoopStatus;
  /** @deprecated Dormant self-critique pass output. */
  selfCritique?: GuidanceSelfCritique;
  /** @deprecated Superseded by `headline`. */
  yesterdaySummary?: string;
  /** @deprecated Superseded by `whatChanged`. */
  progressVsSpec?: ProgressItem[];
  /** @deprecated Superseded by `whatChanged`. */
  advancedChecklistItems?: AdvancedChecklistItem[];
  /** @deprecated Superseded by `blockersOrDecisions`. */
  blockersAndRisks?: BlockerOrRisk[];
  /** @deprecated Superseded by `blockersOrDecisions`. */
  decisionsNeedingApproval?: DecisionNeedingApproval[];
  /** @deprecated Superseded by `nextActions`. */
  plannedSteps?: PlannedStep[];
}
