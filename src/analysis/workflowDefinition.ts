import { HarnessError } from '../errors/HarnessError.js';
import type {
  AnalysisIncludeFlags,
  WorkflowStepDefinition,
  WorkflowStepName,
} from './types/index.js';

/**
 * The AnalyzeCodeChange workflow, in execution order.
 *
 * Single source of truth for step order, the artifact each step produces, its
 * dependencies, and the include flag that controls it. Required steps omit
 * `includeFlag`; `normalizeRequirement` omits `artifactKey` because it fills a
 * session input rather than an artifact.
 */
export const ANALYZE_CODE_CHANGE_WORKFLOW: readonly WorkflowStepDefinition[] = [
  { name: 'normalizeRequirement', dependsOn: [] },
  { name: 'changeExplanation', artifactKey: 'changeExplanation', dependsOn: [] },
  {
    name: 'flowGeneration',
    artifactKey: 'flowArtifact',
    dependsOn: ['changeExplanation'],
    includeFlag: 'includeFlow',
  },
  {
    name: 'requirementAlignment',
    artifactKey: 'requirementAlignment',
    dependsOn: ['normalizeRequirement', 'changeExplanation'],
  },
  {
    name: 'gapReport',
    artifactKey: 'gapReport',
    dependsOn: ['changeExplanation', 'requirementAlignment'],
    includeFlag: 'includeGapReport',
  },
  {
    name: 'videoScript',
    artifactKey: 'videoScript',
    dependsOn: ['changeExplanation', 'requirementAlignment', 'gapReport', 'flowGeneration'],
    includeFlag: 'includeVideoScript',
  },
  {
    name: 'prDescription',
    artifactKey: 'prDescription',
    dependsOn: ['changeExplanation', 'requirementAlignment', 'gapReport', 'flowGeneration'],
    includeFlag: 'includePrDescription',
  },
  {
    name: 'dailyUpdate',
    artifactKey: 'dailyUpdate',
    dependsOn: [
      'changeExplanation',
      'requirementAlignment',
      'gapReport',
      'prDescription',
      'flowGeneration',
    ],
    includeFlag: 'includeDailyUpdate',
  },
];

/** A step runs when it has no include flag (required) or its flag is enabled. */
function isStepEnabled({
  step,
  flags,
}: {
  step: WorkflowStepDefinition;
  flags: AnalysisIncludeFlags;
}): boolean {
  return step.includeFlag === undefined || flags[step.includeFlag];
}

/**
 * Fails fast when an enabled optional step depends on a step whose own include
 * flag is disabled — derived entirely from the workflow definition rather than
 * scattered hardcoded checks. Throws before any skill runs so the failure is
 * clear and skill-free.
 */
export function assertWorkflowIncludeFlags(flags: AnalysisIncludeFlags): void {
  const stepByName = new Map<WorkflowStepName, WorkflowStepDefinition>(
    ANALYZE_CODE_CHANGE_WORKFLOW.map((step) => [step.name, step]),
  );

  for (const step of ANALYZE_CODE_CHANGE_WORKFLOW) {
    if (step.includeFlag === undefined || !isStepEnabled({ step, flags })) {
      continue;
    }

    const missing: string[] = [];
    for (const dependencyName of step.dependsOn) {
      const dependency = stepByName.get(dependencyName);
      if (
        dependency !== undefined &&
        dependency.includeFlag !== undefined &&
        !isStepEnabled({ step: dependency, flags })
      ) {
        missing.push(dependency.includeFlag);
      }
    }

    if (missing.length > 0) {
      throw new HarnessError(
        'VALIDATION',
        `${step.includeFlag} requires ${missing.join(', ')} to be enabled.`,
      );
    }
  }
}
