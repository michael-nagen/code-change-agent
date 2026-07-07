/**
 * The declarative workflow definition.
 *
 * This is NOT a workflow engine, planner, or agent system. It is a small,
 * static description of the AnalyzeCodeChange pipeline: which steps exist, what
 * artifact each produces, what each depends on, and which include flag (if any)
 * controls it. The Harness uses it for dependency validation; execution stays an
 * explicit, readable sequence elsewhere.
 */
import type { AnalysisArtifacts, WorkflowStepName } from './session.js';

/** The optional-step toggles accepted by the analysis pipeline. */
export interface AnalysisIncludeFlags {
  includeFlow: boolean;
  includeGapReport: boolean;
  includeVideoScript: boolean;
  includePrDescription: boolean;
  includeDailyUpdate: boolean;
  includeDailyWorkGuidance: boolean;
  includeTechnicalChangeBrief: boolean;
  includeDemoPrepLoop: boolean;
  includeWeeklyReview: boolean;
}

/**
 * One step of the workflow. `artifactKey` is omitted for steps that produce a
 * session input rather than an artifact (normalizeRequirement). `includeFlag` is
 * omitted for required steps that always run.
 */
export interface WorkflowStepDefinition {
  name: WorkflowStepName;
  artifactKey?: keyof AnalysisArtifacts;
  dependsOn: WorkflowStepName[];
  includeFlag?: keyof AnalysisIncludeFlags;
}
