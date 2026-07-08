import type { RequirementInputAdapter } from '../tools/index.js';
import { hashString } from './hashing.js';
import { HarnessError } from '../errors/HarnessError.js';
import { renderPromptPreferences, type PromptPreferenceCategory } from '../memory/index.js';
import { formatProjectContextForPrompt } from '../sources/index.js';
import { logEvent, startTimer, describeErrorForLog } from '../observability/index.js';
import { runGuidanceSelfCritique } from './guidanceSelfCritique.js';
import type { GuidanceCritiqueSkill } from '../skills/dailyWorkGuidanceCritique/index.js';
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
  includeDailyWorkGuidance,
  includeTechnicalChangeBrief,
  includeDemoPrepLoop,
  includeWeeklyReview,
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
  includeDailyWorkGuidance: boolean;
  includeTechnicalChangeBrief: boolean;
  includeDemoPrepLoop: boolean;
  includeWeeklyReview: boolean;
}): Promise<AnalysisSession> {
  // Connected source context (GitHub/Notion/memory) rendered once as a capped,
  // untrusted, supporting-only block. It is threaded into the narrative skills
  // (daily/technical/demo/weekly); the explicit spec/diff remain the source of
  // truth. Undefined when there is no supporting source, so the section is
  // omitted rather than empty.
  const connectedSourceContext = formatProjectContextForPrompt({
    projectContext: session.inputs.projectContext,
  });

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

  if (includeDailyWorkGuidance) {
    await runStep({
      session,
      step: 'dailyWorkGuidance',
      isAlreadyDone: () => session.artifacts.dailyWorkGuidance !== undefined,
      run: async () => {
        const requirementInput = session.inputs.requirementInput;
        const { changeExplanation, requirementAlignment, gapReport, flowArtifact } =
          session.artifacts;
        if (
          requirementInput === undefined ||
          changeExplanation === undefined ||
          requirementAlignment === undefined ||
          gapReport === undefined ||
          flowArtifact === undefined
        ) {
          throw new HarnessError(
            'INVALID_PHASE',
            'dailyWorkGuidance requires a normalized requirement, change explanation, requirement alignment, gap report, and flow artifact.',
          );
        }

        const { previousProgressMemory, todayGoal } = session.inputs;
        const date = new Date().toISOString().slice(0, 10);
        const userPromptPreferences = preferencesFor({
          session,
          categories: ['dailyUpdate', 'cursor'],
        });
        const skill = registry.resolve('dailyWorkGuidance');
        const generated = await skill.execute({
          specOrChecklist: requirementInput.requirementText,
          date,
          changeExplanation,
          requirementAlignment,
          gapReport,
          flowArtifact,
          ...(previousProgressMemory !== undefined ? { previousProgressMemory } : {}),
          ...(todayGoal !== undefined ? { todayGoal } : {}),
          ...(userPromptPreferences !== undefined ? { userPromptPreferences } : {}),
          ...(connectedSourceContext !== undefined ? { connectedSourceContext } : {}),
        });

        // Bounded self-critique: exactly one pass before the user sees the
        // plan. When no critic is wired (e.g. skill-doubles setups), the plan
        // is shown as generated — critique is quality support, never a gate.
        const criticSkill = tryResolveGuidanceCritiqueSkill(registry);
        session.artifacts.dailyWorkGuidance =
          criticSkill === undefined
            ? generated
            : await runGuidanceSelfCritique({
                skill: criticSkill,
                guidance: generated,
                requirementAlignment,
                gapReport,
                ...(previousProgressMemory !== undefined ? { previousProgressMemory } : {}),
                ...(todayGoal !== undefined ? { todayGoal } : {}),
                checkedAt: new Date().toISOString(),
              });
      },
    });
  }

  if (includeTechnicalChangeBrief) {
    await runStep({
      session,
      step: 'technicalChangeBrief',
      isAlreadyDone: () => session.artifacts.technicalChangeBrief !== undefined,
      run: async () => {
        const requirementInput = session.inputs.requirementInput;
        const { changeExplanation, requirementAlignment, gapReport, flowArtifact, dailyWorkGuidance } =
          session.artifacts;
        if (
          requirementInput === undefined ||
          changeExplanation === undefined ||
          requirementAlignment === undefined
        ) {
          throw new HarnessError(
            'INVALID_PHASE',
            'technicalChangeBrief requires a normalized requirement, change explanation, and requirement alignment.',
          );
        }

        const userPromptPreferences = preferencesFor({ session, categories: ['codeReview'] });
        const skill = registry.resolve('technicalChangeBrief');
        session.artifacts.technicalChangeBrief = await skill.execute({
          rawDiff: session.inputs.rawDiff,
          requirementText: requirementInput.requirementText,
          changeExplanation,
          requirementAlignment,
          ...(gapReport !== undefined ? { gapReport } : {}),
          ...(flowArtifact !== undefined ? { flowArtifact } : {}),
          ...(dailyWorkGuidance !== undefined ? { dailyWorkGuidance } : {}),
          ...(userPromptPreferences !== undefined ? { userPromptPreferences } : {}),
          ...(connectedSourceContext !== undefined ? { connectedSourceContext } : {}),
        });
      },
    });
  }

  if (includeDemoPrepLoop) {
    await runStep({
      session,
      step: 'demoPrepLoop',
      isAlreadyDone: () => session.artifacts.demoPrepLoop !== undefined,
      run: async () => {
        const requirementInput = session.inputs.requirementInput;
        const {
          changeExplanation,
          requirementAlignment,
          gapReport,
          flowArtifact,
          dailyWorkGuidance,
          technicalChangeBrief,
          videoScript,
        } = session.artifacts;
        if (
          requirementInput === undefined ||
          changeExplanation === undefined ||
          requirementAlignment === undefined
        ) {
          throw new HarnessError(
            'INVALID_PHASE',
            'demoPrepLoop requires a normalized requirement, change explanation, and requirement alignment.',
          );
        }

        const userPromptPreferences = preferencesFor({ session, categories: ['demoVideo'] });
        const skill = registry.resolve('demoPrepLoop');
        session.artifacts.demoPrepLoop = await skill.execute({
          rawDiff: session.inputs.rawDiff,
          requirementText: requirementInput.requirementText,
          changeExplanation,
          requirementAlignment,
          ...(gapReport !== undefined ? { gapReport } : {}),
          ...(flowArtifact !== undefined ? { flowArtifact } : {}),
          ...(dailyWorkGuidance !== undefined ? { dailyWorkGuidance } : {}),
          ...(technicalChangeBrief !== undefined ? { technicalChangeBrief } : {}),
          ...(videoScript !== undefined ? { videoScript } : {}),
          ...(userPromptPreferences !== undefined ? { userPromptPreferences } : {}),
          ...(connectedSourceContext !== undefined ? { connectedSourceContext } : {}),
        });
      },
    });
  }

  if (includeWeeklyReview) {
    await runStep({
      session,
      step: 'weeklyReview',
      isAlreadyDone: () => session.artifacts.weeklyReview !== undefined,
      run: async () => {
        const requirementInput = session.inputs.requirementInput;
        const {
          changeExplanation,
          requirementAlignment,
          gapReport,
          flowArtifact,
          dailyWorkGuidance,
          technicalChangeBrief,
          demoPrepLoop,
        } = session.artifacts;
        if (
          requirementInput === undefined ||
          changeExplanation === undefined ||
          requirementAlignment === undefined
        ) {
          throw new HarnessError(
            'INVALID_PHASE',
            'weeklyReview requires a normalized requirement, change explanation, and requirement alignment.',
          );
        }

        const { previousProgressMemory } = session.inputs;
        const generatedAt = new Date().toISOString();
        const userPromptPreferences = preferencesFor({
          session,
          categories: ['weeklyReview', 'mentorUpdate', 'demoVideo'],
        });
        const skill = registry.resolve('weeklyReview');
        session.artifacts.weeklyReview = await skill.execute({
          rawDiff: session.inputs.rawDiff,
          requirementText: requirementInput.requirementText,
          generatedAt,
          changeExplanation,
          requirementAlignment,
          ...(gapReport !== undefined ? { gapReport } : {}),
          ...(flowArtifact !== undefined ? { flowArtifact } : {}),
          ...(dailyWorkGuidance !== undefined ? { dailyWorkGuidance } : {}),
          ...(technicalChangeBrief !== undefined ? { technicalChangeBrief } : {}),
          ...(demoPrepLoop !== undefined ? { demoPrepLoop } : {}),
          ...(previousProgressMemory !== undefined ? { previousProgressMemory } : {}),
          ...(userPromptPreferences !== undefined ? { userPromptPreferences } : {}),
          ...(connectedSourceContext !== undefined ? { connectedSourceContext } : {}),
        });
      },
    });
  }

  return session;
}

/**
 * The critique skill is optional support, not a pipeline dependency: setups
 * that inject only the skills they use (tests, partial harnesses) must keep
 * working, so an unregistered critic means "skip the pass", never a failure.
 */
function tryResolveGuidanceCritiqueSkill(
  registry: SkillRegistry,
): GuidanceCritiqueSkill | undefined {
  try {
    return registry.resolve('dailyWorkGuidanceCritique');
  } catch (error) {
    if (error instanceof HarnessError && error.code === 'UNKNOWN_SKILL') {
      return undefined;
    }
    throw error;
  }
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
    logEvent({ event: 'step_skipped_cached', fields: { step, artifactType: step, cached: true } });
    markCompleted({ session, step });
    return;
  }

  session.status.currentStep = step;
  touch(session);

  logEvent({ event: 'step_started', fields: { step, artifactType: step, cached: false } });
  const stopStepTimer = startTimer();
  try {
    await run();
  } catch (err) {
    if (!session.status.failedSteps.includes(step)) {
      session.status.failedSteps.push(step);
    }
    touch(session);
    logEvent({
      event: 'step_failed',
      level: 'error',
      fields: { step, artifactType: step, durationMs: stopStepTimer(), ...describeErrorForLog(err) },
    });
    throw err;
  }

  markCompleted({ session, step });
  session.status.currentStep = undefined;
  touch(session);
  logEvent({
    event: 'step_completed',
    fields: { step, artifactType: step, cached: false, durationMs: stopStepTimer() },
  });
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

/**
 * Render the developer's prompt preferences for the categories a given skill
 * cares about. Returns undefined when there is nothing to say, so the skill's
 * prompt omits the section entirely (never leaking an empty block).
 */
function preferencesFor({
  session,
  categories,
}: {
  session: AnalysisSession;
  categories: PromptPreferenceCategory[];
}): string | undefined {
  return renderPromptPreferences({
    preferences: session.inputs.promptPreferences,
    categories,
  });
}
