/**
 * UI v0 types.
 *
 * This layer is a thin shell over the official V2 analysis API
 * (`AnalysisHarness` / `AnalysisResult`). It owns no reasoning: it only collects
 * form input, calls a runner, and renders the structured `AnalysisResult`.
 */
import type { AnalysisResult } from '../analysis/index.js';
import type { EditableArtifact } from '../skills/artifactEdit/index.js';
import type { PromptPreferences } from '../memory/index.js';

/**
 * Whether the running UI is backed by the real analysis engine or a clearly
 * labeled demo/mock runner. Surfaced to the page so demo output is never
 * mistaken for real AI output.
 */
export type UiMode = 'real' | 'mock';

/** The optional output steps a run can request, mirroring the V2 include flags. */
export interface AnalysisIncludeSelection {
  includeFlow: boolean;
  includeGapReport: boolean;
  includePrDescription: boolean;
  includeVideoScript: boolean;
  includeDailyUpdate: boolean;
  includeDailyWorkGuidance: boolean;
  includeTechnicalChangeBrief: boolean;
  includeDemoPrepLoop: boolean;
  includeWeeklyReview: boolean;
}

/**
 * Where the requirement + diff come from. Every mode is normalized server-side
 * into the same `{ requirementText, rawDiff }` before the engine runs.
 * - manual            — both fields typed by hand.
 * - githubUrl         — fetch a public GitHub PR/commit `.diff` as the diff.
 * - websiteContextUrl — fetch a page and use its readable text as the requirement.
 * - notionText        — paste exported/copied Notion text as the requirement.
 */
export type InputMode = 'manual' | 'githubUrl' | 'websiteContextUrl' | 'notionText';

export const INPUT_MODES: readonly InputMode[] = [
  'manual',
  'githubUrl',
  'websiteContextUrl',
  'notionText',
];

/**
 * The raw, mode-tagged form submission from the browser. Mode-specific fields
 * are always present as strings (empty when unused) to keep parsing simple;
 * `normalizeInput` reads only the fields relevant to `inputMode`.
 */
export interface FormSubmission extends AnalysisIncludeSelection {
  inputMode: InputMode;
  /** Optional, display-only project name. No persistence in v0. */
  projectName?: string;
  /**
   * Continue an existing analysis. When set, the engine reuses already-present
   * artifacts and only generates newly-requested ones (on-demand generation).
   */
  sessionId?: string;
  requirementText: string;
  rawDiff: string;
  githubUrl: string;
  websiteUrl: string;
  notionText: string;
}

/** A normalized, validated run request handed to the runner/engine. */
export interface AnalysisRequest extends AnalysisIncludeSelection {
  /** Optional, display-only project name. No persistence in v0. */
  projectName?: string;
  /** Continue an existing session for on-demand artifact generation. */
  sessionId?: string;
  requirementText: string;
  rawDiff: string;
  /** Memory owner id (defaults server-side). Used to load durable memory. */
  userId?: string;
  /** Stable memory project key (derived from the project name), if any. */
  projectId?: string;
}

/** The two values every input mode must resolve to before analysis. */
export interface NormalizedInput {
  requirementText: string;
  rawDiff: string;
}

/** Anything the runner can accept: a request plus a runner-agnostic shape. */
export interface AnalysisRunner {
  /** Human-readable label, e.g. "mock-demo" or "openai-compatible". */
  readonly name: string;
  run(request: AnalysisRequest): Promise<AnalysisResult>;
}

/**
 * Where a workspace card belongs:
 * - understanding — analysis findings (What Changed, Requirement Check, …).
 * - actions       — things you do with the analysis (PR Draft, Daily Prep, …).
 * - debug         — developer aids (Raw JSON).
 */
export type CardGroup = 'understanding' | 'actions' | 'debug';

/**
 * Whether the underlying artifact is present in this analysis result.
 * `not_generated` is a friendly empty state, never an error.
 */
export type CardState = 'generated' | 'not_generated';

/** One workspace card: a friendly-labeled view over a single artifact. */
export interface WorkspaceCard {
  /** Stable artifact key, e.g. 'changeExplanation', 'prDescription'. */
  id: string;
  /** Friendly, product-facing label, e.g. 'What Changed', 'PR Draft'. */
  label: string;
  group: CardGroup;
  state: CardState;
  /** Pre-rendered, escaped HTML for the card body. */
  html: string;
  /** Plain text to copy (only set where copy is offered, e.g. PR Draft). */
  copyText?: string;
  /**
   * Extra labeled copy targets beyond the primary `copyText` (e.g. "Notion
   * daily" or a per-step Cursor prompt). Each renders its own copy button.
   */
  copyActions?: { label: string; text: string }[];
  /**
   * Downloadable files built from the artifact (e.g. the Markdown and PPTX
   * decks). Each renders a download button that saves the payload as
   * `filename`. Text files travel in `text`; binary files in `base64` —
   * exactly one of the two is set.
   */
  downloadActions?: {
    label: string;
    filename: string;
    mimeType: string;
    text?: string;
    base64?: string;
  }[];
}

/**
 * A compact, structured summary of the Daily Work Guidance loop, so the
 * Overview can show counts and stage without parsing card HTML. Present only
 * when Daily Work Guidance has been generated.
 */
export interface GuidanceOverview {
  /** The loop stage, e.g. 'planning' | 'revised_plan_pending_approval' | 'approved_plan'. */
  loopStage: string;
  /** Loop-level review state, e.g. 'pending_user_review' | 'approved'. */
  overallStatus: string;
  /** Planned steps + decisions still awaiting a user decision. */
  pendingApprovals: number;
  /** Number of surfaced blockers/risks. */
  blockers: number;
  /** The self-critique outcome, when the bounded self-review pass ran. */
  selfCritique?: { revisionApplied: boolean; issues: number };
  /** The first still-pending planned step's title, as "today's main priority". */
  todayPriority?: string;
}

/**
 * Lightweight summary used to render the Overview panel without re-deriving it
 * from card HTML. Values come straight from the result's artifacts.
 */
export interface AnalysisOverview {
  /** GapReport readiness when present, else null (PR Readiness not yet run). */
  readiness: string | null;
  /** RequirementAlignment confidence (always present after base analysis). */
  confidence: string;
  /**
   * The Daily Work Guidance loop summary, present only once that artifact has
   * been generated. Additive: absent on runs without guidance.
   */
  guidance?: GuidanceOverview;
}

/** A friendly, display-only view of one normalized project-context source. */
export interface SourceSummary {
  /** Where it came from, e.g. 'manual' | 'memory' | 'github' | 'notion'. */
  kind: string;
  title?: string;
  url?: string;
  summary?: string;
}

/** A saved project-memory snapshot, flattened for display. */
export interface MemoryStatusSnapshot {
  /** The latest saved summary (daily or weekly). */
  latestSummary: string;
  /** YYYY-MM-DD the snapshot represents. */
  date: string;
  checklistStatuses: { item: string; status: string }[];
  decisions: string[];
  blockers: string[];
  nextActions: string[];
  /** ISO timestamp of the last write. */
  updatedAt: string;
  /** The saved guidance loop stage, when the snapshot recorded one. */
  loopStage?: string;
  /** The applied plan decisions saved with the snapshot, when any exist. */
  planDecisions?: { itemId: string; action: string; text: string; note?: string }[];
}

/**
 * The stored project memory for the active project, surfaced so memory is a
 * visible product capability rather than a hidden context injection.
 */
export interface MemoryStatus {
  /** The display project name, when one was provided. */
  projectName?: string;
  /** The stable memory key derived from the project name, when resolvable. */
  projectId?: string;
  /** The active spec summary for this run, when available. */
  activeSpecSummary?: string;
  /** Whether a saved snapshot existed and was available to load for this run. */
  loadedForThisRun: boolean;
  /** The saved snapshot, absent when no project memory exists yet. */
  snapshot?: MemoryStatusSnapshot;
  /**
   * The developer's saved personal working / prompt preferences (cross-project,
   * user-level). Present so the panel can display and edit them even when there
   * is no project memory yet. Absent when none are saved.
   */
  promptPreferences?: PromptPreferences;
  /** A memory load error (e.g. a corrupted file), when one occurred. */
  loadError?: string;
}

/**
 * The editable projection of a project's memory the panel sends back on save.
 * It maps to the durable `ProjectProgressSnapshot` plus the project-level
 * `activeSpecSummary`. Checklist statuses are validated against the allowed set
 * before anything is persisted.
 */
export interface EditableProjectMemory {
  activeSpecSummary?: string;
  /** The snapshot date (YYYY-MM-DD); defaults to today for a brand-new snapshot. */
  date?: string;
  dailySummary?: string;
  checklist?: { item: string; status: string }[];
  decisions?: string[];
  blockers?: string[];
  nextActions?: string[];
}

/** The response returned by the edit-memory handler to the client. */
export type EditMemoryResponse =
  | {
      status: 'success';
      /** A short, user-facing confirmation. */
      message: string;
      /** The refreshed memory status (project memory + preferences). */
      memory: MemoryStatus;
    }
  | {
      status: 'error';
      /** The actual error message, shown verbatim in the UI. */
      message: string;
    };

/** The response returned by the clear-memory handler to the client. */
export type ClearMemoryResponse =
  | {
      status: 'success';
      /** The (now empty) memory status for the project. */
      memory: MemoryStatus;
    }
  | {
      status: 'error';
      message: string;
    };

/** The response returned by the analyze handler to the client. */
export type AnalyzeResponse =
  | {
      status: 'success';
      mode: UiMode;
      sessionId: string;
      /** Observability id for the run, shown near run status for traceability. */
      traceId?: string;
      overview: AnalysisOverview;
      /**
       * The resolved inputs for this session, echoed back so the client can
       * issue follow-up on-demand generation calls without re-fetching a
       * GitHub diff or website (it resends these as manual inputs + sessionId).
       */
      inputs: { requirementText: string; rawDiff: string };
      cards: WorkspaceCard[];
      /** The stored project memory for the active project. */
      memory: MemoryStatus;
      /**
       * The normalized project-context sources for this run (manual input +
       * memory + configured GitHub/Notion), so the UI can present sources
       * without exposing Raw JSON. Empty when only manual input was used.
       */
      sources: SourceSummary[];
    }
  | {
      status: 'error';
      mode: UiMode;
      /** The actual error message, shown verbatim in the UI. */
      message: string;
    };

/** The response returned by the chat-edit handler to the client. */
export type ChatEditResponse =
  | {
      status: 'success';
      /** A short, user-facing reply describing what changed. */
      assistantMessage: string;
      /** A one-line summary of the edit. */
      changeSummary: string;
      /** The updated artifact value. */
      updatedArtifact: EditableArtifact;
      /** The re-rendered workspace card so the panel + copy text update in place. */
      card: WorkspaceCard;
      /** Whether an undoable previous version now exists for this artifact. */
      canUndo: boolean;
    }
  | {
      status: 'error';
      /** The actual error message, shown verbatim in the UI. */
      message: string;
    };

/** The response returned by the undo handler to the client. */
export type UndoArtifactEditResponse =
  | {
      status: 'success';
      /** Whether a previous version was actually restored. */
      restored: boolean;
      /** The re-rendered workspace card for the (possibly reverted) artifact. */
      card: WorkspaceCard;
      /** Whether further undo history remains for this artifact. */
      canUndo: boolean;
    }
  | {
      status: 'error';
      message: string;
    };

/** The response returned by the save-memory handler to the client. */
export type SaveMemoryResponse =
  | {
      status: 'success';
      /** A short, user-facing confirmation. */
      message: string;
      /** The date of the snapshot that was persisted. */
      savedDate: string;
      /** The updated memory status, so the Project Memory panel can refresh. */
      memory: MemoryStatus;
    }
  | {
      status: 'error';
      /** The actual error message, shown verbatim in the UI. */
      message: string;
    };

/** The response returned by the write-notion handler to the client. */
export type WriteNotionResponse =
  | {
      status: 'success';
      /** A short, user-facing confirmation (e.g. "Sent to Notion."). */
      message: string;
      /** The title that headed the appended Notion content. */
      title: string;
    }
  | {
      status: 'error';
      /** The actual error message, shown verbatim in the UI. Never a secret. */
      message: string;
    };

/** The response returned by the apply-decisions handler to the client. */
export type ApplyDecisionsResponse =
  | {
      status: 'success';
      /** A short, user-facing confirmation. */
      message: string;
      /** The re-rendered Daily Work Guidance card reflecting the decisions. */
      card: WorkspaceCard;
      /** The loop state after the decisions, so callers can see it advance. */
      loopStatus: { currentStage: string; overallStatus: string };
      /** The model's summary of its re-plan, when reject/edit feedback triggered one. */
      revisionSummary?: string;
      /**
       * The refreshed guidance loop summary after the decisions, so the
       * Overview counts/stage stay in sync without re-analyzing.
       */
      guidance?: GuidanceOverview;
      /**
       * The updated memory status when the decided plan was persisted (a
       * project name was set); absent when there was no project to save under.
       */
      memory?: MemoryStatus;
    }
  | {
      status: 'error';
      /** The actual error message, shown verbatim in the UI. */
      message: string;
    };
