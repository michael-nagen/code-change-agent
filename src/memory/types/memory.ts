/**
 * Memory contract / types.
 *
 * These describe the durable "developer memory" the app carries across analysis
 * runs. They are deliberately storage-agnostic: no field references files, DB
 * rows, or cloud specifics, so the same shapes serialize cleanly to JSON today
 * and to Postgres/Mongo/Supabase/Redis/Notion later.
 *
 * `schemaVersion` is stamped on every persisted record so a future store can
 * detect and migrate older shapes without guessing.
 */

/** Current on-disk/record schema version. Bump when a shape changes. */
export const MEMORY_SCHEMA_VERSION = 1;

/** A checklist item's status, kept as a plain string so memory stays decoupled
 * from any specific skill's status enum. Callers map to/from their own enums. */
export interface ChecklistStatusEntry {
  item: string;
  status: string;
}

/**
 * One recorded plan decision (approve/reject/edit/defer), kept as plain
 * strings so memory stays decoupled from any specific skill's enums.
 */
export interface PlanDecisionRecord {
  /** The decided item's id, e.g. "step-1" or "decision-2". */
  itemId: string;
  /** The user's action, e.g. "approve" | "reject" | "edit" | "defer". */
  action: string;
  /** The item's text after the decision (edited text when action is edit). */
  text: string;
  /** The user's note/reason, when given. */
  note?: string;
}

/**
 * A dated snapshot of a project's progress — the durable form of a Daily Work
 * Guidance memory update. This is what gets replayed as "previous progress"
 * context on the next run.
 */
export interface ProjectProgressSnapshot {
  /** YYYY-MM-DD this snapshot represents. */
  date: string;
  /** One-paragraph human summary of where the project stood. */
  dailySummary: string;
  /** The status of each tracked checklist item at snapshot time. */
  updatedChecklistStatuses: ChecklistStatusEntry[];
  /** Blockers still open at snapshot time. */
  openBlockers: string[];
  /** Decisions still awaiting resolution at snapshot time. */
  openDecisions: string[];
  /** The next actions carried forward. */
  nextActions: string[];
  /**
   * The guidance loop stage at snapshot time (e.g. "planning" or
   * "approved_plan"). Optional and additive: older snapshots stay valid.
   */
  loopStage?: string;
  /** Plan decisions the user applied before this snapshot, when any exist. */
  planDecisions?: PlanDecisionRecord[];
}

/** Project-scoped memory: the latest progress snapshot plus a bounded history. */
export interface ProjectMemory {
  schemaVersion: number;
  userId: string;
  projectId: string;
  /**
   * A short, user-editable summary of the active spec/requirement for this
   * project. Optional and additive: older records without it stay valid, and
   * the run's own requirement summary is used as a fallback when it is absent.
   */
  activeSpecSummary?: string;
  /** The most recent saved snapshot, if any. */
  latestSnapshot?: ProjectProgressSnapshot;
  /** Older snapshots, most recent last. Bounded to keep records small. */
  history: ProjectProgressSnapshot[];
  /** ISO timestamp of the last write. */
  updatedAt: string;
}

/**
 * General response-style preferences that apply to every generated output.
 * All fields are optional; an omitted field means "no stated preference".
 */
export interface GeneralResponsePreferences {
  preferredLanguage?: string;
  preferredTone?: string;
  preferredOutputLength?: string;
  preferredStructure?: string;
  includeConciseSummaries?: boolean;
  includeDetailedImplementationPrompts?: boolean;
}

/**
 * How the developer likes the agent to shape prompts, updates, reviews, and
 * handoff instructions. These are FORMAT/STYLE/WORKFLOW preferences only — they
 * never override factual claims grounded in the current spec/diff.
 *
 * Category lists are free-form bullet strings so users can phrase their own
 * conventions; empty/absent categories simply contribute nothing.
 */
export interface PromptPreferences {
  general?: GeneralResponsePreferences;
  /** How the user likes prompts for Cursor / coding agents. */
  cursor?: string[];
  /** How the user likes handoff prompts for Claude Code. */
  claudeCode?: string[];
  /** How the user likes code review output. */
  codeReview?: string[];
  /** How Daily Work Guidance should format outputs. */
  dailyUpdate?: string[];
  /** How Weekly Review should format outputs. */
  weeklyReview?: string[];
  /** How Demo Prep should prepare demos/videos. */
  demoVideo?: string[];
  /** How updates for mentors / managers / teammates should read. */
  mentorUpdate?: string[];
}

/** User-scoped preferences that persist across projects. */
export interface UserPreferencesMemory {
  schemaVersion: number;
  userId: string;
  /** Free-form preferences the developer wants remembered, e.g. tone/format. */
  preferences: string[];
  /** A recurring default goal, used only when a run states no goal. */
  defaultGoal?: string;
  /**
   * Structured personal working / prompt preferences. Optional and additive:
   * records saved before this field existed stay valid.
   */
  promptPreferences?: PromptPreferences;
  /** ISO timestamp of the last write. */
  updatedAt: string;
}

/**
 * The merged, read-only view handed to the analysis engine for a run. It is
 * assembled from user + project memory and is supporting context only — never a
 * source of truth over the current run's explicit inputs.
 */
export interface DeveloperMemoryContext {
  userId: string;
  projectId?: string;
  userPreferences?: UserPreferencesMemory;
  projectMemory?: ProjectMemory;
  /**
   * A ready-to-use "previous progress" summary derived from project memory,
   * suitable for the Daily Work Guidance `previousProgressMemory` input.
   * Undefined when there is no prior snapshot.
   */
  previousProgressMemory?: string;
  /**
   * Non-fatal notes surfaced while building the context — e.g. "no prior
   * memory", or a conflict/uncertainty the reviewer should be aware of. Memory
   * is supporting context, so these are informational, not errors.
   */
  notes: string[];
}
