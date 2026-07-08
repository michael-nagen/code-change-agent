/**
 * Types for the WeeklyReviewSkill — the higher-level synthesis of a week's work.
 *
 * Weekly Review does NOT replace the daily/technical/demo artifacts; it
 * synthesizes them (plus project memory and the current spec/diff) into the
 * central "what happened this week and why it matters" artifact that can seed a
 * weekly status update, a demo narrative, a video script, or a manager review.
 *
 * It reasons from the current change plus whichever upstream artifacts are
 * available, using them heavily by role:
 *  - TechnicalChangeBrief → what changed technically
 *  - DemoPrepLoop         → the demo/video story, what to show vs say
 *  - DailyWorkGuidance    → daily progress and next steps
 *  - previousProgressMemory → what was already done, decisions, blockers across runs
 * Missing inputs are recorded in `status.missingInputs` and lower the relevant
 * confidence rather than being invented.
 */
import type { ChangeExplanation } from '../changeExplanation/index.js';
import type { RequirementAlignment } from '../requirementAlignment/index.js';
import type { GapReport } from '../gapReport/index.js';
import type { FlowArtifact } from '../flowGeneration/index.js';
import type { DailyWorkGuidance } from '../dailyWorkGuidance/index.js';
import type { TechnicalChangeBrief } from '../technicalChangeBrief/index.js';
import type { DemoPrepLoop } from '../demoPrepLoop/index.js';

export interface WeeklyReviewInput {
  /** The raw diff (PR/commit diff) the week's work is about. */
  rawDiff: string;
  /** The requirement/spec the work was built against. */
  requirementText: string;
  /** ISO timestamp stamped onto the review; the model echoes it. */
  generatedAt: string;
  /** A human label for the period, e.g. "Week of 2026-07-07". Optional. */
  reviewPeriodLabel?: string;
  changeExplanation: ChangeExplanation;
  requirementAlignment: RequirementAlignment;
  /** Present only when the optional gap-report step ran. */
  gapReport?: GapReport;
  /** Present only when the optional flow-generation step ran. */
  flowArtifact?: FlowArtifact;
  /** Present only when daily-work-guidance ran; used for daily progress. */
  dailyWorkGuidance?: DailyWorkGuidance;
  /** Present only when technical-change-brief ran; used heavily for technical synthesis. */
  technicalChangeBrief?: TechnicalChangeBrief;
  /** Present only when demo-prep-loop ran; used heavily for the demo/video story. */
  demoPrepLoop?: DemoPrepLoop;
  /** Prior project progress carried in from memory, when available. */
  previousProgressMemory?: string;
  /**
   * A pre-rendered block of the developer's personal working / prompt
   * preferences (weekly review, mentor/manager update, and demo/video style). It
   * shapes how the review READS only — never the factual claims it synthesizes.
   */
  userPromptPreferences?: string;
  /**
   * A pre-rendered block of connected source context (GitHub/Notion/memory)
   * assembled from the session's project context. SUPPORTING context only — the
   * current run's explicit inputs remain the source of truth over it.
   */
  connectedSourceContext?: string;
}

export type WeeklyReviewStatusValue = 'draft';
export type Confidence = 'high' | 'medium' | 'low';
export type EvidenceLevel = 'confirmed' | 'inferred';

/** Where a piece of the review was synthesized from. */
export type ReviewSource =
  | 'memory'
  | 'daily'
  | 'technical_brief'
  | 'demo_prep'
  | 'current_run'
  | 'inferred';

/** Section 1 — the review's own status/meta. */
export interface WeeklyReviewStatus {
  status: WeeklyReviewStatusValue;
  confidence: Confidence;
  /** Inputs that were unavailable, so the reader knows what is inferred. */
  missingInputs: string[];
  reviewPeriodLabel: string;
  /** ISO timestamp — echoes the provided `generatedAt`. */
  generatedAt: string;
}

/** Section 3 — one spec/checklist item's weekly standing. */
export type SpecItemStatus = 'done' | 'partial' | 'blocked' | 'unclear' | 'not_started';

export interface SpecProgressItem {
  title: string;
  status: SpecItemStatus;
  evidence: string;
  notes: string;
  source: ReviewSource;
}

/** Section 4 — one technical change, path-safe and evidence-tagged. */
export interface TechnicalChangeItem {
  description: string;
  /** Only when a real path is visible in the evidence; never invented. */
  filePath?: string;
  evidence: EvidenceLevel;
}

export interface WhatChangedTechnically {
  schemaOrDataChanges: TechnicalChangeItem[];
  modelOrTypeChanges: TechnicalChangeItem[];
  workflowOrRuntimeChanges: TechnicalChangeItem[];
  uiChanges: TechnicalChangeItem[];
  toolsOrSkillsAdded: TechnicalChangeItem[];
  /** Important files/modules — only real paths from the evidence. */
  importantFilesOrModules: string[];
}

/** Section 5 — a decision made this week. Never pre-approved by the model. */
export type DecisionStatus = 'active' | 'open' | 'superseded';

export interface KeyDecision {
  decision: string;
  why: string;
  impact: string;
  status: DecisionStatus;
  source: ReviewSource;
}

/** Section 6 — a blocker or risk. */
export type RiskStatus = 'open' | 'resolved' | 'needs_review';

export interface WeeklyBlockerOrRisk {
  title: string;
  whyItMatters: string;
  status: RiskStatus;
  suggestedNextAction: string;
}

/** Section 7 — one segment of the recommended 5–7 minute demo structure. */
export interface DemoSegment {
  title: string;
  /** e.g. "~1 min". */
  durationLabel: string;
  focus: string;
}

export interface DemoVideoStory {
  strongestStory: string;
  whatToShow: string[];
  whatToSay: string[];
  whatToSkip: string[];
  recommendedStructure: DemoSegment[];
  keyFilesOrScreens: string[];
  strongestProductSentence: string;
}

/** Section 9 — a copy-ready Notion/Slack weekly update, in a fixed shape. */
export interface SuggestedWeeklyUpdate {
  thisWeek: string;
  technicalProgress: string;
  demoProductProgress: string;
  blockers: string;
  nextWeek: string;
}

/** Section 11 — a savable memory update proposal. */
export interface WeeklyChecklistStatus {
  item: string;
  status: string;
}

export interface WeeklyMemoryUpdateProposal {
  latestWeeklySummary: string;
  updatedChecklistStatuses: WeeklyChecklistStatus[];
  newDecisions: string[];
  updatedBlockers: string[];
  nextActions: string[];
  demoStorySummary: string;
  filesWorthShowing: string[];
}

export interface WeeklyReview {
  status: WeeklyReviewStatus;
  executiveSummary: string;
  progressAgainstSpec: SpecProgressItem[];
  whatChangedTechnically: WhatChangedTechnically;
  keyDecisions: KeyDecision[];
  blockersAndRisks: WeeklyBlockerOrRisk[];
  demoVideoStory: DemoVideoStory;
  reviewTalkingPoints: string[];
  suggestedWeeklyUpdate: SuggestedWeeklyUpdate;
  /** What to do next week — ordered, practical items. */
  nextWeekPlan: string[];
  memoryUpdateProposal: WeeklyMemoryUpdateProposal;
}
