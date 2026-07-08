import { randomUUID } from 'node:crypto';
import { HarnessError } from '../errors/HarnessError.js';
import {
  ManualRequirementInputAdapter,
  DefaultGitInputAdapter,
  createNotionPlugin,
  type RequirementInputAdapter,
  type GitInputAdapter,
  type NotionPlugin,
  type NotionArtifacts,
  type NotionOutputResult,
} from '../tools/index.js';
import type { LanguageModel } from '../llm/LanguageModel.js';
import {
  DefaultChangeExplanationSkill,
  type ChangeExplanationSkill,
} from '../skills/changeExplanation/index.js';
import {
  DefaultRequirementAlignmentSkill,
  type RequirementAlignmentSkill,
} from '../skills/requirementAlignment/index.js';
import { DefaultGapReportSkill, type GapReportSkill } from '../skills/gapReport/index.js';
import {
  DefaultFlowGenerationSkill,
  type FlowGenerationSkill,
} from '../skills/flowGeneration/index.js';
import {
  DefaultVideoScriptSkill,
  type VideoScriptSkill,
} from '../skills/videoScript/index.js';
import {
  DefaultPRDescriptionSkill,
  type PRDescriptionSkill,
} from '../skills/prDescription/index.js';
import {
  DefaultDailyUpdateSkill,
  type DailyUpdateSkill,
} from '../skills/dailyUpdate/index.js';
import {
  DefaultDailyWorkGuidanceSkill,
  type DailyWorkGuidanceSkill,
} from '../skills/dailyWorkGuidance/index.js';
import {
  DefaultGuidanceCritiqueSkill,
  type GuidanceCritiqueSkill,
} from '../skills/dailyWorkGuidanceCritique/index.js';
import {
  DefaultTechnicalChangeBriefSkill,
  type TechnicalChangeBriefSkill,
} from '../skills/technicalChangeBrief/index.js';
import {
  DefaultDemoPrepLoopSkill,
  type DemoPrepLoopSkill,
} from '../skills/demoPrepLoop/index.js';
import {
  DefaultWeeklyReviewSkill,
  type WeeklyReviewSkill,
} from '../skills/weeklyReview/index.js';
import { InMemoryProjectStore } from '../project/index.js';
import type { ProjectStore } from '../project/index.js';
import {
  InMemoryMemoryStore,
  buildDeveloperMemoryContext,
  appendSnapshot,
  DEFAULT_USER_ID,
} from '../memory/index.js';
import type {
  MemoryStore,
  DeveloperMemoryContext,
  ProjectMemory,
  UserPreferencesMemory,
} from '../memory/index.js';
import type { DailyWorkGuidance } from '../skills/dailyWorkGuidance/index.js';
import type { WeeklyReview } from '../skills/weeklyReview/index.js';
import {
  buildNormalizedProjectContext,
  resolveExternalSources,
} from '../sources/index.js';
import type { NotionConnector, GitHubConnector } from '../sources/index.js';
import {
  logEvent,
  runWithTrace,
  updateTraceContext,
  newTraceId,
  startTimer,
  describeErrorForLog,
} from '../observability/index.js';
import { snapshotFromDailyWorkGuidance, snapshotFromWeeklyReview } from './memoryMapping.js';
import { DefaultSkillRegistry } from './DefaultSkillRegistry.js';
import { InMemoryArtifactStore } from './InMemoryArtifactStore.js';
import { hashString } from './hashing.js';
import { runAnalyzeCodeChange } from './AnalyzeCodeChangeWorkflow.js';
import { assertWorkflowIncludeFlags } from './workflowDefinition.js';
import type {
  AnalysisResult,
  AnalysisSession,
  ArtifactStore,
  RegisteredSkills,
  SkillKey,
  SkillRegistry,
} from './types/index.js';

/**
 * Dependencies for the Harness.
 *
 * Every skill is LLM-backed and depends on an injected LanguageModel. A caller
 * can either inject fully-constructed skills (e.g. test doubles, or skills built
 * on different models) or supply a single `model`, in which case the Harness
 * constructs the default LLM-backed skill for any skill not provided. The
 * Harness never references a concrete model provider itself.
 *
 * If a workflow step is requested but its skill was neither injected nor
 * constructable (no `model`), the run fails closed at resolve time rather than
 * silently skipping reasoning.
 */
export interface AnalysisHarnessDeps {
  /**
   * Shared LanguageModel used to construct the default LLM-backed skill for any
   * skill not explicitly injected below. Optional only so callers can inject
   * every skill directly; omit it and a not-injected, requested skill fails closed.
   */
  model?: LanguageModel;
  changeExplanation?: ChangeExplanationSkill;
  requirementAlignment?: RequirementAlignmentSkill;
  flowGeneration?: FlowGenerationSkill;
  gapReport?: GapReportSkill;
  videoScript?: VideoScriptSkill;
  prDescription?: PRDescriptionSkill;
  dailyUpdate?: DailyUpdateSkill;
  dailyWorkGuidance?: DailyWorkGuidanceSkill;
  /** Self-critique pass over the generated guidance plan; optional like the rest. */
  dailyWorkGuidanceCritique?: GuidanceCritiqueSkill;
  technicalChangeBrief?: TechnicalChangeBriefSkill;
  demoPrepLoop?: DemoPrepLoopSkill;
  weeklyReview?: WeeklyReviewSkill;
  store?: ArtifactStore;
  /**
   * Stores Projects and the sessions they own. Defaults to in-memory. When a
   * `projectId` is passed to an analysis entry point, the resulting session is
   * attached to the matching project through this store.
   */
  projectStore?: ProjectStore;
  /**
   * Durable developer memory. Defaults to an in-memory store so tests and
   * library use never touch the filesystem; local/production runs inject a
   * persistent store (see `resolveMemoryStore`). The harness depends only on the
   * `MemoryStore` interface, never on how memory is stored.
   */
  memoryStore?: MemoryStore;
  /**
   * Optional external-source connectors. When provided (via `resolveConnectors`
   * from env), the harness assembles a unified project context behind the
   * scenes. Absent by default, so manual flows are unchanged. The harness
   * depends only on the connector interfaces, never on a concrete provider.
   */
  notionConnector?: NotionConnector;
  githubConnector?: GitHubConnector;
  /** Default source ids/urls used when a run does not pass its own. */
  sourceDefaults?: { notionPageId?: string; githubPrUrl?: string };
  requirementAdapter?: RequirementInputAdapter;
  /** Input adapter for git-sourced analysis; defaults to wrapping the real tool. */
  gitInputAdapter?: GitInputAdapter;
  /** Bidirectional Notion plugin; defaults to the in-memory/text implementation. */
  notionPlugin?: NotionPlugin;
}

/** Parameters for a single analysis run. Extracted so the public trace wrapper
 * and the traced implementation share one contract. */
export interface RunAnalysisParams {
  projectId?: string;
  /** Owner of the memory to load/save. Defaults to the single MVP user. */
  userId?: string;
  rawDiff: string;
  requirementText: string;
  sessionId?: string;
  /** Optional prior-session progress memory, used by daily-work-guidance. */
  previousProgressMemory?: string;
  /** Optional goal for today, used by daily-work-guidance. */
  todayGoal?: string;
  /** Optional Notion page id/URL to read as an external source this run. */
  notionPageId?: string;
  /** Optional GitHub PR/commit URL to read as an external source this run. */
  githubPrUrl?: string;
  includeFlow?: boolean;
  includeGapReport?: boolean;
  includeVideoScript?: boolean;
  includePrDescription?: boolean;
  includeDailyUpdate?: boolean;
  includeDailyWorkGuidance?: boolean;
  includeTechnicalChangeBrief?: boolean;
  includeDemoPrepLoop?: boolean;
  includeWeeklyReview?: boolean;
}

/**
 * The Harness: the orchestration layer.
 *
 * It wires adapters and skills into the AnalyzeCodeChange workflow, stores
 * sessions, and reuses artifacts. It contains no reasoning: it never builds
 * prompts, never parses or validates LLM output, and never interprets diffs or
 * requirements — those belong to the skills it calls.
 */
export class AnalysisHarness {
  private readonly registry: SkillRegistry;
  private readonly store: ArtifactStore;
  private readonly projectStore: ProjectStore;
  private readonly memoryStore: MemoryStore;
  private readonly notionConnector?: NotionConnector;
  private readonly githubConnector?: GitHubConnector;
  private readonly sourceDefaults: { notionPageId?: string; githubPrUrl?: string };
  private readonly requirementAdapter: RequirementInputAdapter;
  private readonly gitInputAdapter: GitInputAdapter;
  private readonly notionPlugin: NotionPlugin;

  constructor(deps: AnalysisHarnessDeps) {
    const registry = new DefaultSkillRegistry();
    const { model } = deps;

    // Register an injected skill if present; otherwise construct the default
    // LLM-backed skill from the shared model. With neither, the skill is left
    // unregistered so a requested step fails closed at resolve time.
    const registerSkill = <K extends SkillKey>({
      key,
      provided,
      makeDefault,
    }: {
      key: K;
      provided: RegisteredSkills[K] | undefined;
      makeDefault: (model: LanguageModel) => RegisteredSkills[K];
    }): void => {
      const skill = provided ?? (model !== undefined ? makeDefault(model) : undefined);
      if (skill !== undefined) {
        registry.register({ key, skill });
      }
    };

    registerSkill({
      key: 'changeExplanation',
      provided: deps.changeExplanation,
      makeDefault: (m) => new DefaultChangeExplanationSkill(m),
    });
    registerSkill({
      key: 'requirementAlignment',
      provided: deps.requirementAlignment,
      makeDefault: (m) => new DefaultRequirementAlignmentSkill(m),
    });
    registerSkill({
      key: 'flowGeneration',
      provided: deps.flowGeneration,
      makeDefault: (m) => new DefaultFlowGenerationSkill(m),
    });
    registerSkill({
      key: 'gapReport',
      provided: deps.gapReport,
      makeDefault: (m) => new DefaultGapReportSkill(m),
    });
    registerSkill({
      key: 'videoScript',
      provided: deps.videoScript,
      makeDefault: (m) => new DefaultVideoScriptSkill(m),
    });
    registerSkill({
      key: 'prDescription',
      provided: deps.prDescription,
      makeDefault: (m) => new DefaultPRDescriptionSkill(m),
    });
    registerSkill({
      key: 'dailyUpdate',
      provided: deps.dailyUpdate,
      makeDefault: (m) => new DefaultDailyUpdateSkill(m),
    });
    registerSkill({
      key: 'dailyWorkGuidance',
      provided: deps.dailyWorkGuidance,
      makeDefault: (m) => new DefaultDailyWorkGuidanceSkill(m),
    });
    registerSkill({
      key: 'dailyWorkGuidanceCritique',
      provided: deps.dailyWorkGuidanceCritique,
      makeDefault: (m) => new DefaultGuidanceCritiqueSkill(m),
    });
    registerSkill({
      key: 'technicalChangeBrief',
      provided: deps.technicalChangeBrief,
      makeDefault: (m) => new DefaultTechnicalChangeBriefSkill(m),
    });
    registerSkill({
      key: 'demoPrepLoop',
      provided: deps.demoPrepLoop,
      makeDefault: (m) => new DefaultDemoPrepLoopSkill(m),
    });
    registerSkill({
      key: 'weeklyReview',
      provided: deps.weeklyReview,
      makeDefault: (m) => new DefaultWeeklyReviewSkill(m),
    });

    this.registry = registry;
    this.store = deps.store ?? new InMemoryArtifactStore();
    this.projectStore = deps.projectStore ?? new InMemoryProjectStore();
    this.memoryStore = deps.memoryStore ?? new InMemoryMemoryStore();
    if (deps.notionConnector !== undefined) this.notionConnector = deps.notionConnector;
    if (deps.githubConnector !== undefined) this.githubConnector = deps.githubConnector;
    this.sourceDefaults = deps.sourceDefaults ?? {};
    this.requirementAdapter = deps.requirementAdapter ?? new ManualRequirementInputAdapter();
    this.gitInputAdapter = deps.gitInputAdapter ?? new DefaultGitInputAdapter();
    this.notionPlugin = deps.notionPlugin ?? createNotionPlugin();
  }

  /**
   * Run the AnalyzeCodeChange workflow and return a structured result.
   *
   * Pass a `sessionId` of a previous run to continue it: any artifacts already
   * present are reused and their skills are not called again.
   *
   * Establishes a per-run trace context (`traceId`) so every step, model call,
   * memory, and self-critique event emitted during the run shares that id. This
   * is observability only — it does not change what the run produces.
   */
  async runAnalysis(params: RunAnalysisParams): Promise<AnalysisResult> {
    const traceId = newTraceId();
    return runWithTrace({ traceId }, async () => {
      const stopRunTimer = startTimer();
      logEvent({
        event: 'run_started',
        fields: {
          ...(params.projectId !== undefined ? { projectId: params.projectId } : {}),
          reusingSession: params.sessionId !== undefined,
          requestedOutputs: requestedOutputs(params),
        },
      });
      try {
        const result = await this.executeAnalysis(params);
        result.traceId = traceId;
        logEvent({
          event: 'run_completed',
          fields: {
            durationMs: stopRunTimer(),
            artifactsProduced: producedArtifacts(result),
            selfCritiqueApplied: result.dailyWorkGuidance?.selfCritique?.revisionApplied ?? false,
          },
        });
        return result;
      } catch (err) {
        logEvent({
          event: 'run_failed',
          level: 'error',
          fields: { durationMs: stopRunTimer(), ...describeErrorForLog(err) },
        });
        throw err;
      }
    });
  }

  private async executeAnalysis({
    projectId,
    userId,
    rawDiff,
    requirementText,
    sessionId,
    previousProgressMemory,
    todayGoal,
    notionPageId,
    githubPrUrl,
    includeFlow = true,
    includeGapReport = true,
    includeVideoScript = false,
    includePrDescription = false,
    includeDailyUpdate = false,
    includeDailyWorkGuidance = false,
    includeTechnicalChangeBrief = false,
    includeDemoPrepLoop = false,
    includeWeeklyReview = false,
  }: RunAnalysisParams): Promise<AnalysisResult> {
    this.assertNonEmpty({ field: 'rawDiff', value: rawDiff });
    this.assertNonEmpty({ field: 'requirementText', value: requirementText });
    assertWorkflowIncludeFlags({
      includeFlow,
      includeGapReport,
      includeVideoScript,
      includePrDescription,
      includeDailyUpdate,
      includeDailyWorkGuidance,
      includeTechnicalChangeBrief,
      includeDemoPrepLoop,
      includeWeeklyReview,
    });

    const { session, reused } = this.loadOrCreateSession({ rawDiff, sessionId, projectId });
    // Now that the session id is known, stamp it (and the project id) onto the
    // trace so every subsequent step/memory/model event in this run carries it.
    updateTraceContext({
      sessionId: session.sessionId,
      ...(projectId !== undefined ? { projectId } : {}),
    });
    if (reused) {
      await this.assertReusedSessionInputsMatch({ session, rawDiff, requirementText });
    }

    // Load durable memory as SUPPORTING context. The current run's explicit
    // inputs are the source of truth: memory only fills gaps, never overrides.
    const memoryContext = await this.loadMemoryContext({ userId, projectId });
    const resolvedPreviousProgress =
      previousProgressMemory ?? memoryContext?.previousProgressMemory;
    const resolvedTodayGoal = todayGoal ?? memoryContext?.userPreferences?.defaultGoal;
    const resolvedPromptPreferences = memoryContext?.userPreferences?.promptPreferences;

    if (resolvedPreviousProgress !== undefined) {
      session.inputs.previousProgressMemory = resolvedPreviousProgress;
    }
    if (resolvedTodayGoal !== undefined) {
      session.inputs.todayGoal = resolvedTodayGoal;
    }
    if (resolvedPromptPreferences !== undefined) {
      session.inputs.promptPreferences = resolvedPromptPreferences;
    }

    // Assemble the unified project context behind the scenes: manual input
    // (source of truth) + memory (supporting) + any configured external sources.
    // External source resolution is fail-open, so manual flows never break.
    const resolvedNotionPageId = resolveId({
      perRun: notionPageId,
      fallback: this.sourceDefaults.notionPageId,
    });
    const resolvedGithubPrUrl = resolveId({
      perRun: githubPrUrl,
      fallback: this.sourceDefaults.githubPrUrl,
    });
    const { sources: externalSources } = await resolveExternalSources({
      ...(this.notionConnector !== undefined ? { notionConnector: this.notionConnector } : {}),
      ...(this.githubConnector !== undefined ? { githubConnector: this.githubConnector } : {}),
      ...(resolvedNotionPageId !== undefined ? { notionPageId: resolvedNotionPageId } : {}),
      ...(resolvedGithubPrUrl !== undefined ? { githubPrUrl: resolvedGithubPrUrl } : {}),
    });
    session.inputs.projectContext = buildNormalizedProjectContext({
      manualRequirementText: requirementText,
      manualDiffText: rawDiff,
      ...(memoryContext !== undefined ? { memoryContext } : {}),
      externalSources,
    });

    await runAnalyzeCodeChange({
      session,
      registry: this.registry,
      requirementAdapter: this.requirementAdapter,
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
    });

    this.store.save(session);

    // Attach only to a project that actually exists in the project store. A
    // projectId can also be a memory key that was never registered as a project
    // (e.g. from the UI), so a missing project is not an error here.
    if (
      session.projectId !== undefined &&
      this.projectStore.getProject({ projectId: session.projectId }) !== undefined
    ) {
      this.projectStore.attachSessionToProject({
        projectId: session.projectId,
        sessionId: session.sessionId,
      });
    }

    return this.toResult(session);
  }

  /**
   * Run the analysis starting from a local git repository instead of a raw diff.
   *
   * The GitInputAdapter reads + normalizes the git input; the rest of the
   * pipeline is identical to `runAnalysis`. Include flags are forwarded as-is so
   * `runAnalysis` remains the single owner of their defaults.
   */
  async runAnalysisFromGit({
    projectId,
    userId,
    repoPath,
    baseRef,
    headRef,
    requirementText,
    sessionId,
    previousProgressMemory,
    todayGoal,
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
    projectId?: string;
    userId?: string;
    repoPath: string;
    baseRef?: string;
    headRef?: string;
    requirementText: string;
    sessionId?: string;
    previousProgressMemory?: string;
    todayGoal?: string;
    includeFlow?: boolean;
    includeGapReport?: boolean;
    includeVideoScript?: boolean;
    includePrDescription?: boolean;
    includeDailyUpdate?: boolean;
    includeDailyWorkGuidance?: boolean;
    includeTechnicalChangeBrief?: boolean;
    includeDemoPrepLoop?: boolean;
    includeWeeklyReview?: boolean;
  }): Promise<AnalysisResult> {
    const gitInput = await this.gitInputAdapter.execute({
      repoPath,
      requirementText,
      ...(baseRef !== undefined ? { baseRef } : {}),
      ...(headRef !== undefined ? { headRef } : {}),
    });

    return this.runAnalysis({
      rawDiff: gitInput.rawDiff,
      requirementText: gitInput.requirementText,
      ...(projectId !== undefined ? { projectId } : {}),
      ...(userId !== undefined ? { userId } : {}),
      ...(sessionId !== undefined ? { sessionId } : {}),
      ...(previousProgressMemory !== undefined ? { previousProgressMemory } : {}),
      ...(todayGoal !== undefined ? { todayGoal } : {}),
      ...(includeFlow !== undefined ? { includeFlow } : {}),
      ...(includeGapReport !== undefined ? { includeGapReport } : {}),
      ...(includeVideoScript !== undefined ? { includeVideoScript } : {}),
      ...(includePrDescription !== undefined ? { includePrDescription } : {}),
      ...(includeDailyUpdate !== undefined ? { includeDailyUpdate } : {}),
      ...(includeDailyWorkGuidance !== undefined ? { includeDailyWorkGuidance } : {}),
      ...(includeTechnicalChangeBrief !== undefined ? { includeTechnicalChangeBrief } : {}),
      ...(includeDemoPrepLoop !== undefined ? { includeDemoPrepLoop } : {}),
      ...(includeWeeklyReview !== undefined ? { includeWeeklyReview } : {}),
    });
  }

  /**
   * Run the analysis starting from Notion-sourced requirement text.
   *
   * The NotionInputAdapter produces the requirement text; the diff is still
   * supplied directly. The rest of the pipeline is identical to `runAnalysis`,
   * which remains the single owner of the include-flag defaults.
   */
  async runAnalysisFromNotion({
    projectId,
    userId,
    rawDiff,
    rawText,
    notionPageId,
    notionUrl,
    title,
    sessionId,
    previousProgressMemory,
    todayGoal,
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
    projectId?: string;
    userId?: string;
    rawDiff: string;
    rawText?: string;
    notionPageId?: string;
    notionUrl?: string;
    title?: string;
    sessionId?: string;
    previousProgressMemory?: string;
    todayGoal?: string;
    includeFlow?: boolean;
    includeGapReport?: boolean;
    includeVideoScript?: boolean;
    includePrDescription?: boolean;
    includeDailyUpdate?: boolean;
    includeDailyWorkGuidance?: boolean;
    includeTechnicalChangeBrief?: boolean;
    includeDemoPrepLoop?: boolean;
    includeWeeklyReview?: boolean;
  }): Promise<AnalysisResult> {
    const requirement = await this.notionPlugin.input.execute({
      ...(rawText !== undefined ? { rawText } : {}),
      ...(notionPageId !== undefined ? { notionPageId } : {}),
      ...(notionUrl !== undefined ? { notionUrl } : {}),
      ...(title !== undefined ? { title } : {}),
    });

    return this.runAnalysis({
      rawDiff,
      requirementText: requirement.requirementText,
      ...(projectId !== undefined ? { projectId } : {}),
      ...(userId !== undefined ? { userId } : {}),
      ...(sessionId !== undefined ? { sessionId } : {}),
      ...(previousProgressMemory !== undefined ? { previousProgressMemory } : {}),
      ...(todayGoal !== undefined ? { todayGoal } : {}),
      ...(includeFlow !== undefined ? { includeFlow } : {}),
      ...(includeGapReport !== undefined ? { includeGapReport } : {}),
      ...(includeVideoScript !== undefined ? { includeVideoScript } : {}),
      ...(includePrDescription !== undefined ? { includePrDescription } : {}),
      ...(includeDailyUpdate !== undefined ? { includeDailyUpdate } : {}),
      ...(includeDailyWorkGuidance !== undefined ? { includeDailyWorkGuidance } : {}),
      ...(includeTechnicalChangeBrief !== undefined ? { includeTechnicalChangeBrief } : {}),
      ...(includeDemoPrepLoop !== undefined ? { includeDemoPrepLoop } : {}),
      ...(includeWeeklyReview !== undefined ? { includeWeeklyReview } : {}),
    });
  }

  /**
   * Format selected artifacts from an existing session into Notion-ready text.
   *
   * It never runs skills: it only reads artifacts already on the session. When
   * `include` explicitly requests an artifact that the session does not have,
   * this fails clearly rather than writing a partial result. When `include` is
   * omitted, every artifact present on the session is written.
   */
  async writeAnalysisToNotion({
    sessionId,
    notionPageId,
    notionUrl,
    include,
  }: {
    sessionId: string;
    notionPageId?: string;
    notionUrl?: string;
    include?: {
      changeExplanation?: boolean;
      requirementAlignment?: boolean;
      gapReport?: boolean;
      flowArtifact?: boolean;
      prDescription?: boolean;
      videoScript?: boolean;
      dailyUpdate?: boolean;
    };
  }): Promise<NotionOutputResult> {
    const session = this.store.get(sessionId);
    if (session === undefined) {
      throw new HarnessError('INVALID_PHASE', `Unknown session: ${sessionId}`);
    }

    const { artifacts, missing } = collectNotionArtifacts({ session, include });
    if (missing.length > 0) {
      throw new HarnessError(
        'INVALID_PHASE',
        `Cannot write to Notion: requested artifacts missing from the session: ${missing.join(', ')}. Run the corresponding skills first.`,
      );
    }

    return this.notionPlugin.output.execute({
      artifacts,
      ...(notionPageId !== undefined ? { notionPageId } : {}),
      ...(notionUrl !== undefined ? { notionUrl } : {}),
    });
  }

  /** Read-only access to a stored session (immutable snapshot). */
  getSession(sessionId: string): AnalysisSession | undefined {
    return this.store.get(sessionId);
  }

  /**
   * Load the developer memory context for a run. Fails OPEN: memory is only
   * supporting context, so a load error (e.g. a corrupted record) must never
   * crash an analysis — it is treated as "no memory". Returns undefined when no
   * project id is given (nothing project-scoped to load).
   */
  private async loadMemoryContext({
    userId,
    projectId,
  }: {
    userId: string | undefined;
    projectId: string | undefined;
  }): Promise<DeveloperMemoryContext | undefined> {
    if (projectId === undefined) return undefined;
    const resolvedUserId = userId ?? DEFAULT_USER_ID;
    try {
      const [userPreferences, projectMemory] = await Promise.all([
        this.memoryStore.getUserMemory({ userId: resolvedUserId }),
        this.memoryStore.getProjectMemory({ userId: resolvedUserId, projectId }),
      ]);
      const context = buildDeveloperMemoryContext({
        userId: resolvedUserId,
        projectId,
        ...(userPreferences !== undefined ? { userMemory: userPreferences } : {}),
        ...(projectMemory !== undefined ? { projectMemory } : {}),
      });
      logEvent({
        event: 'memory_loaded',
        fields: {
          userMemoryPresent: userPreferences !== undefined,
          projectMemoryPresent: projectMemory !== undefined,
          hasPreviousProgress: context.previousProgressMemory !== undefined,
          snapshotHistoryCount: projectMemory?.history.length ?? 0,
        },
      });
      return context;
    } catch (err) {
      // Fail open: memory is supporting context, not a source of truth.
      logEvent({ event: 'memory_loaded', level: 'warn', fields: { loaded: false, ...describeErrorForLog(err) } });
      return undefined;
    }
  }

  /**
   * Assemble the developer memory context for preview/UI without running an
   * analysis. Surfaces load errors via the MemoryStore (does not fail open).
   */
  async getDeveloperMemoryContext({
    userId,
    projectId,
  }: {
    userId?: string;
    projectId: string;
  }): Promise<DeveloperMemoryContext> {
    const resolvedUserId = userId ?? DEFAULT_USER_ID;
    const [userPreferences, projectMemory] = await Promise.all([
      this.memoryStore.getUserMemory({ userId: resolvedUserId }),
      this.memoryStore.getProjectMemory({ userId: resolvedUserId, projectId }),
    ]);
    return buildDeveloperMemoryContext({
      userId: resolvedUserId,
      projectId,
      ...(userPreferences !== undefined ? { userMemory: userPreferences } : {}),
      ...(projectMemory !== undefined ? { projectMemory } : {}),
    });
  }

  getUserMemory({ userId }: { userId?: string }): Promise<UserPreferencesMemory | undefined> {
    return this.memoryStore.getUserMemory({ userId: userId ?? DEFAULT_USER_ID });
  }

  async saveUserMemory({
    userId,
    memory,
  }: {
    userId?: string;
    memory: UserPreferencesMemory;
  }): Promise<void> {
    await this.memoryStore.saveUserMemory({ userId: userId ?? DEFAULT_USER_ID, memory });
    logEvent({ event: 'memory_saved', fields: { scope: 'user' } });
  }

  getProjectMemory({
    userId,
    projectId,
  }: {
    userId?: string;
    projectId: string;
  }): Promise<ProjectMemory | undefined> {
    return this.memoryStore.getProjectMemory({ userId: userId ?? DEFAULT_USER_ID, projectId });
  }

  async saveProjectMemory({
    userId,
    projectId,
    memory,
  }: {
    userId?: string;
    projectId: string;
    memory: ProjectMemory;
  }): Promise<void> {
    await this.memoryStore.saveProjectMemory({
      userId: userId ?? DEFAULT_USER_ID,
      projectId,
      memory,
    });
    logEvent({
      event: 'memory_saved',
      fields: { scope: 'project', projectId, snapshotHistoryCount: memory.history.length },
    });
  }

  /**
   * Explicit, user-confirmed save path: turn a run's Daily Work Guidance memory
   * update into a durable project snapshot and persist it (appending the prior
   * snapshot to history). Never called automatically — model output is only
   * saved when the user asks. Returns the stored ProjectMemory.
   */
  async saveProjectMemoryFromGuidance({
    userId,
    projectId,
    guidance,
    now,
  }: {
    userId?: string;
    projectId: string;
    guidance: DailyWorkGuidance;
    now?: string;
  }): Promise<ProjectMemory> {
    const resolvedUserId = userId ?? DEFAULT_USER_ID;
    const snapshot = snapshotFromDailyWorkGuidance(guidance);
    const existing = await this.memoryStore.getProjectMemory({
      userId: resolvedUserId,
      projectId,
    });
    const memory = appendSnapshot({
      userId: resolvedUserId,
      projectId,
      snapshot,
      ...(existing !== undefined ? { existing } : {}),
      ...(now !== undefined ? { now } : {}),
    });
    await this.memoryStore.saveProjectMemory({ userId: resolvedUserId, projectId, memory });
    logEvent({
      event: 'memory_saved',
      fields: {
        scope: 'project',
        projectId,
        source: 'dailyWorkGuidance',
        snapshotDate: snapshot.date,
        snapshotHistoryCount: memory.history.length,
      },
    });
    return memory;
  }

  /**
   * Explicit save path for a Weekly Review's memory update proposal — mirrors
   * `saveProjectMemoryFromGuidance`. Never called automatically; the weekly
   * summary/decisions/blockers/next-actions become a durable project snapshot.
   */
  async saveProjectMemoryFromWeeklyReview({
    userId,
    projectId,
    weeklyReview,
    now,
  }: {
    userId?: string;
    projectId: string;
    weeklyReview: WeeklyReview;
    now?: string;
  }): Promise<ProjectMemory> {
    const resolvedUserId = userId ?? DEFAULT_USER_ID;
    const snapshot = snapshotFromWeeklyReview(weeklyReview);
    const existing = await this.memoryStore.getProjectMemory({
      userId: resolvedUserId,
      projectId,
    });
    const memory = appendSnapshot({
      userId: resolvedUserId,
      projectId,
      snapshot,
      ...(existing !== undefined ? { existing } : {}),
      ...(now !== undefined ? { now } : {}),
    });
    await this.memoryStore.saveProjectMemory({ userId: resolvedUserId, projectId, memory });
    logEvent({
      event: 'memory_saved',
      fields: {
        scope: 'project',
        projectId,
        source: 'weeklyReview',
        snapshotDate: snapshot.date,
        snapshotHistoryCount: memory.history.length,
      },
    });
    return memory;
  }

  private loadOrCreateSession({
    rawDiff,
    sessionId,
    projectId,
  }: {
    rawDiff: string;
    sessionId: string | undefined;
    projectId: string | undefined;
  }): { session: AnalysisSession; reused: boolean } {
    if (sessionId !== undefined) {
      const existing = this.store.get(sessionId);
      if (existing !== undefined) {
        if (projectId !== undefined) {
          existing.projectId = projectId;
        }
        return { session: existing, reused: true };
      }
    }

    const now = new Date().toISOString();
    return {
      session: {
        sessionId: sessionId ?? randomUUID(),
        ...(projectId !== undefined ? { projectId } : {}),
        inputs: { rawDiff },
        artifacts: {},
        status: { currentStep: undefined, completedSteps: [], failedSteps: [] },
        metadata: { createdAt: now, updatedAt: now, diffHash: hashString(rawDiff) },
      },
      reused: false,
    };
  }

  /**
   * Guard against silently returning a stale analysis. A reused session must
   * describe the SAME inputs it was analyzed for; otherwise the workflow would
   * skip already-present steps and hand back an analysis that belongs to a
   * different diff/requirement. Fails closed with SESSION_INPUT_MISMATCH so the
   * caller starts a new session (omit `sessionId`) for different inputs.
   *
   * The requirement is compared on its NORMALIZED identity — the incoming text
   * is run through the same requirement adapter used to populate the session —
   * so cosmetic differences (e.g. surrounding whitespace) are not treated as a
   * mismatch. Comparisons are skipped when the stored value is absent (nothing
   * stale to protect yet); those steps simply run fresh.
   */
  private async assertReusedSessionInputsMatch({
    session,
    rawDiff,
    requirementText,
  }: {
    session: AnalysisSession;
    rawDiff: string;
    requirementText: string;
  }): Promise<void> {
    const storedDiffHash = session.metadata.diffHash;
    if (storedDiffHash !== undefined && storedDiffHash !== hashString(rawDiff)) {
      throw new HarnessError(
        'SESSION_INPUT_MISMATCH',
        `Session "${session.sessionId}" was analyzed for a different code diff. ` +
          'Reusing a session requires identical inputs; start a new session (omit sessionId) to analyze a different diff.',
      );
    }

    const storedRequirement = session.inputs.requirementInput;
    if (storedRequirement !== undefined) {
      const normalized = await this.requirementAdapter.execute({ requirementText });
      if (normalized.requirementText !== storedRequirement.requirementText) {
        throw new HarnessError(
          'SESSION_INPUT_MISMATCH',
          `Session "${session.sessionId}" was analyzed for a different requirement. ` +
            'Reusing a session requires identical inputs; start a new session (omit sessionId) to analyze a different requirement.',
        );
      }
    }
  }

  private toResult(session: AnalysisSession): AnalysisResult {
    const { requirementInput } = session.inputs;
    const { changeExplanation, requirementAlignment } = session.artifacts;

    if (
      requirementInput === undefined ||
      changeExplanation === undefined ||
      requirementAlignment === undefined
    ) {
      throw new HarnessError(
        'INVALID_PHASE',
        'Workflow did not produce all artifacts required for a result.',
      );
    }

    const result: AnalysisResult = {
      sessionId: session.sessionId,
      requirementInput,
      changeExplanation,
      requirementAlignment,
    };

    if (session.artifacts.flowArtifact !== undefined) {
      result.flowArtifact = session.artifacts.flowArtifact;
    }
    if (session.artifacts.gapReport !== undefined) {
      result.gapReport = session.artifacts.gapReport;
    }
    if (session.artifacts.videoScript !== undefined) {
      result.videoScript = session.artifacts.videoScript;
    }
    if (session.artifacts.prDescription !== undefined) {
      result.prDescription = session.artifacts.prDescription;
    }
    if (session.artifacts.dailyUpdate !== undefined) {
      result.dailyUpdate = session.artifacts.dailyUpdate;
    }
    if (session.artifacts.dailyWorkGuidance !== undefined) {
      result.dailyWorkGuidance = session.artifacts.dailyWorkGuidance;
    }
    if (session.artifacts.technicalChangeBrief !== undefined) {
      result.technicalChangeBrief = session.artifacts.technicalChangeBrief;
    }
    if (session.artifacts.demoPrepLoop !== undefined) {
      result.demoPrepLoop = session.artifacts.demoPrepLoop;
    }
    if (session.artifacts.weeklyReview !== undefined) {
      result.weeklyReview = session.artifacts.weeklyReview;
    }
    if (session.inputs.projectContext !== undefined) {
      result.projectContext = session.inputs.projectContext;
    }

    return result;
  }

  private assertNonEmpty({ field, value }: { field: string; value: string }): void {
    if (value.trim() === '') {
      throw new HarnessError('VALIDATION', `${field} must not be empty.`);
    }
  }
}

/** The requested optional outputs for a run, as booleans — safe to log (no content). */
function requestedOutputs(params: RunAnalysisParams): Record<string, boolean> {
  return {
    flow: params.includeFlow ?? true,
    gapReport: params.includeGapReport ?? true,
    videoScript: params.includeVideoScript ?? false,
    prDescription: params.includePrDescription ?? false,
    dailyUpdate: params.includeDailyUpdate ?? false,
    dailyWorkGuidance: params.includeDailyWorkGuidance ?? false,
    technicalChangeBrief: params.includeTechnicalChangeBrief ?? false,
    demoPrepLoop: params.includeDemoPrepLoop ?? false,
    weeklyReview: params.includeWeeklyReview ?? false,
  };
}

/** The artifact keys actually produced on a result — names only, never content. */
function producedArtifacts(result: AnalysisResult): string[] {
  const keys: (keyof AnalysisResult)[] = [
    'changeExplanation',
    'requirementAlignment',
    'flowArtifact',
    'gapReport',
    'prDescription',
    'videoScript',
    'dailyUpdate',
    'dailyWorkGuidance',
    'technicalChangeBrief',
    'demoPrepLoop',
    'weeklyReview',
  ];
  return keys.filter((key) => result[key] !== undefined);
}

/** Prefer a per-run source id/url over the configured default; trim to undefined. */
function resolveId({
  perRun,
  fallback,
}: {
  perRun: string | undefined;
  fallback: string | undefined;
}): string | undefined {
  const chosen = perRun !== undefined && perRun.trim() !== '' ? perRun : fallback;
  return chosen !== undefined && chosen.trim() !== '' ? chosen : undefined;
}

type NotionInclude = {
  changeExplanation?: boolean;
  requirementAlignment?: boolean;
  gapReport?: boolean;
  flowArtifact?: boolean;
  prDescription?: boolean;
  videoScript?: boolean;
  dailyUpdate?: boolean;
};

/**
 * Selects artifacts from the session for Notion output. With no `include`, every
 * present artifact is selected. With an explicit `include`, a requested artifact
 * absent from the session is reported in `missing` (handled per key to stay
 * type-safe). It never produces an artifact the session does not hold.
 */
function collectNotionArtifacts({
  session,
  include,
}: {
  session: AnalysisSession;
  include: NotionInclude | undefined;
}): { artifacts: NotionArtifacts; missing: string[] } {
  const artifacts: NotionArtifacts = {};
  const missing: string[] = [];
  const wantAll = include === undefined;
  const source = session.artifacts;

  if (wantAll ? source.changeExplanation !== undefined : include.changeExplanation === true) {
    if (source.changeExplanation === undefined) missing.push('changeExplanation');
    else artifacts.changeExplanation = source.changeExplanation;
  }
  if (wantAll ? source.requirementAlignment !== undefined : include.requirementAlignment === true) {
    if (source.requirementAlignment === undefined) missing.push('requirementAlignment');
    else artifacts.requirementAlignment = source.requirementAlignment;
  }
  if (wantAll ? source.gapReport !== undefined : include.gapReport === true) {
    if (source.gapReport === undefined) missing.push('gapReport');
    else artifacts.gapReport = source.gapReport;
  }
  if (wantAll ? source.flowArtifact !== undefined : include.flowArtifact === true) {
    if (source.flowArtifact === undefined) missing.push('flowArtifact');
    else artifacts.flowArtifact = source.flowArtifact;
  }
  if (wantAll ? source.prDescription !== undefined : include.prDescription === true) {
    if (source.prDescription === undefined) missing.push('prDescription');
    else artifacts.prDescription = source.prDescription;
  }
  if (wantAll ? source.videoScript !== undefined : include.videoScript === true) {
    if (source.videoScript === undefined) missing.push('videoScript');
    else artifacts.videoScript = source.videoScript;
  }
  if (wantAll ? source.dailyUpdate !== undefined : include.dailyUpdate === true) {
    if (source.dailyUpdate === undefined) missing.push('dailyUpdate');
    else artifacts.dailyUpdate = source.dailyUpdate;
  }

  return { artifacts, missing };
}
