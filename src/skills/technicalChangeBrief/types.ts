/**
 * Types for the TechnicalChangeBriefSkill — a technical explanation artifact.
 *
 * The brief prepares a clear, implementation-focused explanation of what a code
 * change did: schema/model/API/workflow/UI changes, the most interesting
 * functionality, an end-to-end flow, the files worth showing, and ready-to-use
 * talking points. It is meant to help a developer explain the work in a PR,
 * demo, walkthrough, or technical discussion.
 *
 * It is NOT the PR Description artifact and it is NOT a reviewer-question
 * generator. It is a structured technical narrative of the actual change.
 *
 * Unlike most downstream skills, this one DOES receive the raw diff: it explains
 * concrete implementation details, so it reasons from the diff plus the upstream
 * analysis artifacts. Optional artifacts (gap report, flow, daily work guidance)
 * are consumed only when they are available on the session.
 *
 * The output is deliberately structured (not one markdown blob) so the UI can
 * render each section on its own and copy targets can be assembled cleanly.
 */
import type { ChangeExplanation } from '../changeExplanation/index.js';
import type { RequirementAlignment } from '../requirementAlignment/index.js';
import type { GapReport } from '../gapReport/index.js';
import type { FlowArtifact } from '../flowGeneration/index.js';
import type { DailyWorkGuidance } from '../dailyWorkGuidance/index.js';

export interface TechnicalChangeBriefInput {
  /** The raw diff (PR diff / commit diff) the brief explains. */
  rawDiff: string;
  /** The requirement or spec the change was built against. */
  requirementText: string;
  changeExplanation: ChangeExplanation;
  requirementAlignment: RequirementAlignment;
  /** Present only when the optional gap-report step ran. */
  gapReport?: GapReport;
  /** Present only when the optional flow-generation step ran. */
  flowArtifact?: FlowArtifact;
  /** Present only when the optional daily-work-guidance step ran. */
  dailyWorkGuidance?: DailyWorkGuidance;
  /**
   * A pre-rendered block of the developer's personal working / prompt
   * preferences (technical explanation and code-review style). It shapes how the
   * brief READS only — never the factual claims about the change.
   */
  userPromptPreferences?: string;
  /**
   * A pre-rendered block of connected source context (GitHub/Notion/memory)
   * assembled from the session's project context. SUPPORTING context only — the
   * requirement/spec and diff remain the source of truth for factual claims.
   */
  connectedSourceContext?: string;
}

/**
 * How strongly a detail is supported by the diff/analysis.
 * - confirmed — directly visible in the provided diff or analysis artifacts.
 * - inferred  — a reasonable impact/interpretation, not directly shown.
 */
export type EvidenceLevel = 'confirmed' | 'inferred';

/** Whether the change keeps existing persisted/session data working. */
export type BackwardCompatibility = 'compatible' | 'breaking' | 'unclear';

/** One data/schema-level change (a field, schema, contract, or enum). */
export interface SchemaChangeItem {
  /** The field/schema/contract/enum name. */
  name: string;
  /** File path, when visible from the diff. */
  filePath?: string;
  /** What changed and why it matters at the data level. */
  description: string;
  evidence: EvidenceLevel;
}

/**
 * Section 2 — Data / Schema Changes. When `hasChanges` is false, `summary`
 * states that clearly and the arrays are empty.
 */
export interface DataSchemaChanges {
  hasChanges: boolean;
  /** A short prose summary; states "no data/schema changes" clearly when none. */
  summary: string;
  newFields: SchemaChangeItem[];
  changedFields: SchemaChangeItem[];
  removedFields: SchemaChangeItem[];
  /** New artifact/output schemas introduced. */
  newSchemas: SchemaChangeItem[];
  /** Changed parser/serialization contracts. */
  changedParserContracts: SchemaChangeItem[];
  /** New status values or enum members. */
  newStatusValues: SchemaChangeItem[];
  /** Whether existing persisted/session data is affected. */
  persistedDataImpact: string;
  backwardCompatibility: BackwardCompatibility;
  /** A short note explaining the backward-compatibility call. */
  backwardCompatibilityNote: string;
}

/** Section 3 — an important model/type/interface added or changed. */
export interface ModelOrType {
  name: string;
  filePath?: string;
  /** What it represents. */
  represents: string;
  /** Why it was needed. */
  whyNeeded: string;
  /** Its important fields. */
  importantFields: string[];
  evidence: EvidenceLevel;
}

/** The kind of input/API/flag surface a change introduces. */
export type InputApiKind =
  | 'includeFlag'
  | 'requestField'
  | 'optionalInput'
  | 'requiredInput'
  | 'artifactKey'
  | 'route'
  | 'other';

/** Section 4 — a new input, API-level change, or workflow flag. */
export interface InputApiFlag {
  name: string;
  kind: InputApiKind;
  description: string;
  filePath?: string;
  evidence: EvidenceLevel;
}

/** Section 5 — how the change affects the analysis workflow / runtime. */
export interface WorkflowRuntimeChanges {
  /** Short prose summary of the workflow/runtime impact. */
  summary: string;
  /** Where the new step/logic runs in the pipeline. */
  whereItRuns: string;
  /** What it depends on. */
  dependsOn: string[];
  /** What artifacts it consumes. */
  consumesArtifacts: string[];
  /** What artifact it produces ("None" when it produces no artifact). */
  producesArtifact: string;
  /** Whether it is cached/reused. */
  cachedOrReused: string;
  /** What happens when its flag is off. */
  behaviorWhenFlagOff: string;
}

/** Section 6 — UI changes. When `hasChanges` is false, arrays are empty. */
export interface UiChanges {
  hasChanges: boolean;
  /** A short prose summary; states "no UI changes" clearly when none. */
  summary: string;
  /** New cards/views introduced. */
  newCardsOrViews: string[];
  /** Toggles/buttons added. */
  togglesOrButtons: string[];
  /** Copy/export actions added. */
  copyActions: string[];
  /** Sections displayed by the new UI. */
  sectionsDisplayed: string[];
  /** How the user activates the feature. */
  howToActivate: string;
}

/** Section 7 — an especially interesting piece of functionality, explained. */
export interface InterestingFunctionality {
  title: string;
  /** What it does. */
  whatItDoes: string;
  /** Why it matters. */
  whyItMatters: string;
  /** How it works internally. */
  howItWorks: string;
  /** Files involved. */
  filesInvolved: string[];
}

/** Section 8 — one step in the end-to-end technical flow. */
export interface HowItWorksStep {
  /** Who/what performs this step, when useful (e.g. "User", "Parser"). */
  actor?: string;
  /** The action taken at this step. */
  action: string;
  /** Optional extra technical detail. */
  detail?: string;
}

/** Section 9 — a file worth showing in a walkthrough/demo. */
export interface FileWorthShowing {
  path: string;
  /** Why it matters. */
  whyItMatters: string;
  /** What to point out in it. */
  whatToPointOut: string;
}

/**
 * The Technical Change Brief artifact: a structured, implementation-focused
 * explanation of a code change, section by section.
 */
export interface TechnicalChangeBrief {
  /** Section 1 — a short summary of what was built and why. */
  executiveSummary: string;
  /** Section 2 — data/schema changes (or a clear "none"). */
  dataSchemaChanges: DataSchemaChanges;
  /** Section 3 — important models/types/interfaces added or changed. */
  modelsAndTypes: ModelOrType[];
  /** Section 4 — new inputs, API changes, or workflow flags. */
  inputsApiFlags: InputApiFlag[];
  /** Section 5 — workflow/runtime changes. */
  workflowRuntimeChanges: WorkflowRuntimeChanges;
  /** Section 6 — UI changes (or a clear "none"). */
  uiChanges: UiChanges;
  /** Section 7 — the most interesting functionality, explained. */
  interestingFunctionality: InterestingFunctionality[];
  /** Section 8 — a clear technical flow from user input to final artifact. */
  howItWorksStepByStep: HowItWorksStep[];
  /** Section 9 — the files most worth showing. */
  filesWorthShowing: FileWorthShowing[];
  /** Section 10 — concise talking points for explaining the change. */
  talkingPoints: string[];
}
