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
import { InMemoryProjectStore } from '../project/index.js';
import type { ProjectStore } from '../project/index.js';
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
  store?: ArtifactStore;
  /**
   * Stores Projects and the sessions they own. Defaults to in-memory. When a
   * `projectId` is passed to an analysis entry point, the resulting session is
   * attached to the matching project through this store.
   */
  projectStore?: ProjectStore;
  requirementAdapter?: RequirementInputAdapter;
  /** Input adapter for git-sourced analysis; defaults to wrapping the real tool. */
  gitInputAdapter?: GitInputAdapter;
  /** Bidirectional Notion plugin; defaults to the in-memory/text implementation. */
  notionPlugin?: NotionPlugin;
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

    this.registry = registry;
    this.store = deps.store ?? new InMemoryArtifactStore();
    this.projectStore = deps.projectStore ?? new InMemoryProjectStore();
    this.requirementAdapter = deps.requirementAdapter ?? new ManualRequirementInputAdapter();
    this.gitInputAdapter = deps.gitInputAdapter ?? new DefaultGitInputAdapter();
    this.notionPlugin = deps.notionPlugin ?? createNotionPlugin();
  }

  /**
   * Run the AnalyzeCodeChange workflow and return a structured result.
   *
   * Pass a `sessionId` of a previous run to continue it: any artifacts already
   * present are reused and their skills are not called again.
   */
  async runAnalysis({
    projectId,
    rawDiff,
    requirementText,
    sessionId,
    includeFlow = true,
    includeGapReport = true,
    includeVideoScript = false,
    includePrDescription = false,
    includeDailyUpdate = false,
  }: {
    projectId?: string;
    rawDiff: string;
    requirementText: string;
    sessionId?: string;
    includeFlow?: boolean;
    includeGapReport?: boolean;
    includeVideoScript?: boolean;
    includePrDescription?: boolean;
    includeDailyUpdate?: boolean;
  }): Promise<AnalysisResult> {
    this.assertNonEmpty({ field: 'rawDiff', value: rawDiff });
    this.assertNonEmpty({ field: 'requirementText', value: requirementText });
    assertWorkflowIncludeFlags({
      includeFlow,
      includeGapReport,
      includeVideoScript,
      includePrDescription,
      includeDailyUpdate,
    });

    const session = this.loadOrCreateSession({ rawDiff, sessionId, projectId });

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
    });

    this.store.save(session);

    if (session.projectId !== undefined) {
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
    repoPath,
    baseRef,
    headRef,
    requirementText,
    sessionId,
    includeFlow,
    includeGapReport,
    includeVideoScript,
    includePrDescription,
    includeDailyUpdate,
  }: {
    projectId?: string;
    repoPath: string;
    baseRef?: string;
    headRef?: string;
    requirementText: string;
    sessionId?: string;
    includeFlow?: boolean;
    includeGapReport?: boolean;
    includeVideoScript?: boolean;
    includePrDescription?: boolean;
    includeDailyUpdate?: boolean;
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
      ...(sessionId !== undefined ? { sessionId } : {}),
      ...(includeFlow !== undefined ? { includeFlow } : {}),
      ...(includeGapReport !== undefined ? { includeGapReport } : {}),
      ...(includeVideoScript !== undefined ? { includeVideoScript } : {}),
      ...(includePrDescription !== undefined ? { includePrDescription } : {}),
      ...(includeDailyUpdate !== undefined ? { includeDailyUpdate } : {}),
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
    rawDiff,
    rawText,
    notionPageId,
    notionUrl,
    title,
    sessionId,
    includeFlow,
    includeGapReport,
    includeVideoScript,
    includePrDescription,
    includeDailyUpdate,
  }: {
    projectId?: string;
    rawDiff: string;
    rawText?: string;
    notionPageId?: string;
    notionUrl?: string;
    title?: string;
    sessionId?: string;
    includeFlow?: boolean;
    includeGapReport?: boolean;
    includeVideoScript?: boolean;
    includePrDescription?: boolean;
    includeDailyUpdate?: boolean;
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
      ...(sessionId !== undefined ? { sessionId } : {}),
      ...(includeFlow !== undefined ? { includeFlow } : {}),
      ...(includeGapReport !== undefined ? { includeGapReport } : {}),
      ...(includeVideoScript !== undefined ? { includeVideoScript } : {}),
      ...(includePrDescription !== undefined ? { includePrDescription } : {}),
      ...(includeDailyUpdate !== undefined ? { includeDailyUpdate } : {}),
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

  private loadOrCreateSession({
    rawDiff,
    sessionId,
    projectId,
  }: {
    rawDiff: string;
    sessionId: string | undefined;
    projectId: string | undefined;
  }): AnalysisSession {
    if (sessionId !== undefined) {
      const existing = this.store.get(sessionId);
      if (existing !== undefined) {
        if (projectId !== undefined) {
          existing.projectId = projectId;
        }
        return existing;
      }
    }

    const now = new Date().toISOString();
    return {
      sessionId: sessionId ?? randomUUID(),
      ...(projectId !== undefined ? { projectId } : {}),
      inputs: { rawDiff },
      artifacts: {},
      status: { currentStep: undefined, completedSteps: [], failedSteps: [] },
      metadata: { createdAt: now, updatedAt: now, diffHash: hashString(rawDiff) },
    };
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

    return result;
  }

  private assertNonEmpty({ field, value }: { field: string; value: string }): void {
    if (value.trim() === '') {
      throw new HarnessError('VALIDATION', `${field} must not be empty.`);
    }
  }
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
