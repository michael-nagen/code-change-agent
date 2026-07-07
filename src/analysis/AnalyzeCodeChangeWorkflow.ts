import type { RequirementInputAdapter } from '../tools/index.js';
import { hashString } from './hashing.js';
import { HarnessError } from '../errors/HarnessError.js';
import type {
  AnalysisSession,
  SkillRegistry,
  WorkflowStepName,
} from './types/index.js';

/**
 * The AnalyzeCodeChange workflow.
 *
 * It sequences the steps and, before each, checks whether the step's output
 * already exists on the session — if so it is skipped, so a skill is never
 * re-run for an artifact that is already present. The workflow itself does no
 * reasoning: it only invokes the requirement adapter and the registered skills
 * and records their outputs on the session.
 */
export async function runAnalyzeCodeChange({
  session,
  registry,
  requirementAdapter,
  requirementText,
  includeFlow,
  includeGapReport,
  includeVideoScript,
  includePrDescription,
  includeDailyUpdate,
}: {
  session: AnalysisSession;
  registry: SkillRegistry;
  requirementAdapter: RequirementInputAdapter;
  requirementText: string;
  includeFlow: boolean;
  includeGapReport: boolean;
  includeVideoScript: boolean;
  includePrDescription: boolean;
  includeDailyUpdate: boolean;
}): Promise<AnalysisSession> {
  await runStep({
    session,
    step: 'normalizeRequirement',
    isAlreadyDone: () => session.inputs.requirementInput !== undefined,
    run: async () => {
      const requirementInput = await requirementAdapter.execute({ requirementText });
      session.inputs.requirementInput = requirementInput;
      session.metadata.requirementHash = hashString(requirementInput.requirementText);
    },
  });

  await runStep({
    session,
    step: 'changeExplanation',
    isAlreadyDone: () => session.artifacts.changeExplanation !== undefined,
    run: async () => {
      const skill = registry.resolve('changeExplanation');
      const changeExplanation = await skill.execute({ diff: session.inputs.rawDiff });
      session.artifacts.changeExplanation = changeExplanation;
      session.metadata.changeExplanationHash = hashString(JSON.stringify(changeExplanation));
    },
  });

  if (includeFlow) {
    await runStep({
      session,
      step: 'flowGeneration',
      isAlreadyDone: () => session.artifacts.flowArtifact !== undefined,
      run: async () => {
        const changeExplanation = session.artifacts.changeExplanation;
        if (changeExplanation === undefined) {
          throw new HarnessError(
            'INVALID_PHASE',
            'flowGeneration requires a change explanation.',
          );
        }

        const skill = registry.resolve('flowGeneration');
        session.artifacts.flowArtifact = await skill.execute({ changeExplanation });
      },
    });
  }

  await runStep({
    session,
    step: 'requirementAlignment',
    isAlreadyDone: () => session.artifacts.requirementAlignment !== undefined,
    run: async () => {
      const requirementInput = session.inputs.requirementInput;
      const changeExplanation = session.artifacts.changeExplanation;
      if (requirementInput === undefined || changeExplanation === undefined) {
        throw new HarnessError(
          'INVALID_PHASE',
          'requirementAlignment requires a normalized requirement and a change explanation.',
        );
      }

      const skill = registry.resolve('requirementAlignment');
      const requirementAlignment = await skill.execute({
        requirementText: requirementInput.requirementText,
        changeExplanation,
        rawDiff: session.inputs.rawDiff,
      });
      session.artifacts.requirementAlignment = requirementAlignment;
    },
  });

  if (includeGapReport) {
    await runStep({
      session,
      step: 'gapReport',
      isAlreadyDone: () => session.artifacts.gapReport !== undefined,
      run: async () => {
        const changeExplanation = session.artifacts.changeExplanation;
        const requirementAlignment = session.artifacts.requirementAlignment;
        if (changeExplanation === undefined || requirementAlignment === undefined) {
          throw new HarnessError(
            'INVALID_PHASE',
            'gapReport requires a change explanation and a requirement alignment.',
          );
        }

        const skill = registry.resolve('gapReport');
        session.artifacts.gapReport = await skill.execute({
          changeExplanation,
          requirementAlignment,
        });
      },
    });
  }

  if (includeVideoScript) {
    await runStep({
      session,
      step: 'videoScript',
      isAlreadyDone: () => session.artifacts.videoScript !== undefined,
      run: async () => {
        const changeExplanation = session.artifacts.changeExplanation;
        const requirementAlignment = session.artifacts.requirementAlignment;
        const gapReport = session.artifacts.gapReport;
        const flowArtifact = session.artifacts.flowArtifact;
        if (
          changeExplanation === undefined ||
          requirementAlignment === undefined ||
          gapReport === undefined ||
          flowArtifact === undefined
        ) {
          throw new HarnessError(
            'INVALID_PHASE',
            'videoScript requires a change explanation, requirement alignment, gap report, and flow artifact.',
          );
        }

        const skill = registry.resolve('videoScript');
        session.artifacts.videoScript = await skill.execute({
          changeExplanation,
          requirementAlignment,
          gapReport,
          flowArtifact,
        });
      },
    });
  }

  if (includePrDescription) {
    await runStep({
      session,
      step: 'prDescription',
      isAlreadyDone: () => session.artifacts.prDescription !== undefined,
      run: async () => {
        const { changeExplanation, requirementAlignment, gapReport, flowArtifact } =
          session.artifacts;
        if (
          changeExplanation === undefined ||
          requirementAlignment === undefined ||
          gapReport === undefined ||
          flowArtifact === undefined
        ) {
          throw new HarnessError(
            'INVALID_PHASE',
            'prDescription requires change explanation, requirement alignment, gap report, and flow artifact.',
          );
        }

        const skill = registry.resolve('prDescription');
        session.artifacts.prDescription = await skill.execute({
          changeExplanation,
          requirementAlignment,
          gapReport,
          flowArtifact,
        });
      },
    });
  }

  if (includeDailyUpdate) {
    await runStep({
      session,
      step: 'dailyUpdate',
      isAlreadyDone: () => session.artifacts.dailyUpdate !== undefined,
      run: async () => {
        const { changeExplanation, requirementAlignment, gapReport, prDescription, flowArtifact } =
          session.artifacts;
        if (
          changeExplanation === undefined ||
          requirementAlignment === undefined ||
          gapReport === undefined ||
          prDescription === undefined ||
          flowArtifact === undefined
        ) {
          throw new HarnessError(
            'INVALID_PHASE',
            'dailyUpdate requires change explanation, requirement alignment, gap report, PR description, and flow artifact.',
          );
        }

        const skill = registry.resolve('dailyUpdate');
        session.artifacts.dailyUpdate = await skill.execute({
          changeExplanation,
          requirementAlignment,
          gapReport,
          prDescription,
          flowArtifact,
        });
      },
    });
  }

  return session;
}

/**
 * Runs one step with reuse + status bookkeeping. An already-done step is marked
 * complete without invoking its skill. A failing step is recorded in
 * `failedSteps` and the error is rethrown so the caller can fail fast.
 */
async function runStep({
  session,
  step,
  isAlreadyDone,
  run,
}: {
  session: AnalysisSession;
  step: WorkflowStepName;
  isAlreadyDone: () => boolean;
  run: () => Promise<void>;
}): Promise<void> {
  if (isAlreadyDone()) {
    markCompleted({ session, step });
    return;
  }

  session.status.currentStep = step;
  touch(session);

  try {
    await run();
  } catch (err) {
    if (!session.status.failedSteps.includes(step)) {
      session.status.failedSteps.push(step);
    }
    touch(session);
    throw err;
  }

  markCompleted({ session, step });
  session.status.currentStep = undefined;
  touch(session);
}

function markCompleted({
  session,
  step,
}: {
  session: AnalysisSession;
  step: WorkflowStepName;
}): void {
  if (!session.status.completedSteps.includes(step)) {
    session.status.completedSteps.push(step);
  }
  session.status.failedSteps = session.status.failedSteps.filter((s) => s !== step);
}

function touch(session: AnalysisSession): void {
  session.metadata.updatedAt = new Date().toISOString();
}
