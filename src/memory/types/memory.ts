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
}

/** Project-scoped memory: the latest progress snapshot plus a bounded history. */
export interface ProjectMemory {
  schemaVersion: number;
  userId: string;
  projectId: string;
  /** The most recent saved snapshot, if any. */
  latestSnapshot?: ProjectProgressSnapshot;
  /** Older snapshots, most recent last. Bounded to keep records small. */
  history: ProjectProgressSnapshot[];
  /** ISO timestamp of the last write. */
  updatedAt: string;
}

/** User-scoped preferences that persist across projects. */
export interface UserPreferencesMemory {
  schemaVersion: number;
  userId: string;
  /** Free-form preferences the developer wants remembered, e.g. tone/format. */
  preferences: string[];
  /** A recurring default goal, used only when a run states no goal. */
  defaultGoal?: string;
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
