/**
 * UI v0 types.
 *
 * This layer is a thin shell over the official V2 analysis API
 * (`AnalysisHarness` / `AnalysisResult`). It owns no reasoning: it only collects
 * form input, calls a runner, and renders the structured `AnalysisResult`.
 */
import type { AnalysisResult } from '../analysis/index.js';
import type { EditableArtifact } from '../skills/artifactEdit/index.js';

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
   * A downloadable file built from the artifact (e.g. the Markdown deck).
   * Renders a download button that saves `text` as `filename`.
   */
  downloadAction?: { label: string; filename: string; text: string };
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
}

/** The response returned by the analyze handler to the client. */
export type AnalyzeResponse =
  | {
      status: 'success';
      mode: UiMode;
      sessionId: string;
      overview: AnalysisOverview;
      /**
       * The resolved inputs for this session, echoed back so the client can
       * issue follow-up on-demand generation calls without re-fetching a
       * GitHub diff or website (it resends these as manual inputs + sessionId).
       */
      inputs: { requirementText: string; rawDiff: string };
      cards: WorkspaceCard[];
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
    }
  | {
      status: 'error';
      /** The actual error message, shown verbatim in the UI. */
      message: string;
    };
