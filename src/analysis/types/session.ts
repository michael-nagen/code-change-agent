/**
 * The AnalysisSession model.
 *
 * A session is a plain data container: inputs, the artifacts produced by skills,
 * workflow status, and metadata. It holds no behavior and no reasoning — the
 * Harness orchestrates it and skills fill it in.
 *
 * Deliberately NOT here: long-term memory, vector stores, RAG, autonomous or
 * multi-agent state. A session is short-lived and self-contained.
 */
import type { RequirementInput } from '../../tools/index.js';
import type { ChangeExplanation } from '../../skills/changeExplanation/index.js';
import type { RequirementAlignment } from '../../skills/requirementAlignment/index.js';
import type { GapReport } from '../../skills/gapReport/index.js';
import type { FlowArtifact } from '../../skills/flowGeneration/index.js';
import type { PRDescription } from '../../skills/prDescription/index.js';
import type { VideoScript } from '../../skills/videoScript/index.js';
import type { DailyUpdate } from '../../skills/dailyUpdate/index.js';
import type { DailyWorkGuidance } from '../../skills/dailyWorkGuidance/index.js';
import type { TechnicalChangeBrief } from '../../skills/technicalChangeBrief/index.js';
import type { DemoPrepLoop } from '../../skills/demoPrepLoop/index.js';
import type { WeeklyReview } from '../../skills/weeklyReview/index.js';

/** The ordered steps of the AnalyzeCodeChange workflow. */
export type WorkflowStepName =
  | 'normalizeRequirement'
  | 'changeExplanation'
  | 'flowGeneration'
  | 'requirementAlignment'
  | 'gapReport'
  | 'videoScript'
  | 'prDescription'
  | 'dailyUpdate'
  | 'dailyWorkGuidance'
  | 'technicalChangeBrief'
  | 'demoPrepLoop'
  | 'weeklyReview';

/**
 * Raw inputs for a session. `requirementInput` is populated once the manual
 * requirement adapter has normalized the caller's requirement text.
 */
export interface AnalysisInputs {
  rawDiff: string;
  requirementInput?: RequirementInput;
  /**
   * Previous progress memory carried in from an earlier session, used by the
   * daily-work-guidance step to tell what advanced. Optional guidance input.
   */
  previousProgressMemory?: string;
  /** An optional goal for today, forwarded to the daily-work-guidance step. */
  todayGoal?: string;
}

/**
 * Artifacts produced by skills during the workflow. Each is the canonical,
 * reusable output of its skill — downstream steps and future skills consume
 * these rather than re-running analysis.
 */
export interface AnalysisArtifacts {
  changeExplanation?: ChangeExplanation;
  flowArtifact?: FlowArtifact;
  requirementAlignment?: RequirementAlignment;
  gapReport?: GapReport;
  prDescription?: PRDescription;
  videoScript?: VideoScript;
  dailyUpdate?: DailyUpdate;
  dailyWorkGuidance?: DailyWorkGuidance;
  technicalChangeBrief?: TechnicalChangeBrief;
  demoPrepLoop?: DemoPrepLoop;
  weeklyReview?: WeeklyReview;
}

/**
 * Workflow progress. `currentStep` is the step in flight (undefined when idle);
 * completed/failed steps record the outcome of each attempted step.
 */
export interface WorkflowStatus {
  currentStep: WorkflowStepName | undefined;
  completedSteps: WorkflowStepName[];
  failedSteps: WorkflowStepName[];
}

/**
 * Bookkeeping for a session. Hashes are stored so a future persistent store can
 * detect when an input changed and invalidate a reused artifact; they are not
 * used for reasoning.
 */
export interface SessionMetadata {
  createdAt: string;
  updatedAt: string;
  diffHash?: string;
  requirementHash?: string;
  changeExplanationHash?: string;
}

export interface AnalysisSession {
  sessionId: string;
  /**
   * The project this session belongs to, if any. Optional so existing,
   * project-less sessions keep working unchanged.
   */
  projectId?: string;
  inputs: AnalysisInputs;
  artifacts: AnalysisArtifacts;
  status: WorkflowStatus;
  metadata: SessionMetadata;
}
