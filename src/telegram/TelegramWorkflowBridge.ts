/**
 * The adapter from Telegram to the EXISTING analysis workflow.
 *
 * It contains no reasoning and no LLM logic. It only translates a Telegram
 * generation request into the same server handlers the UI uses:
 *  - `handleAnalyze`     runs/reuses the analysis via the injected runner and
 *                        caches the full result in a shared `UiSessionStore`;
 *  - `handleSaveMemory`  persists a run's proposed daily/weekly memory update;
 *  - `handleClearMemory` clears ONLY the project memory.
 *
 * Source strategy (never invents inputs): explicit pasted `spec:`/`diff:` text is
 * the source of truth; otherwise a configured GitHub PR provides the diff and the
 * saved active-spec-summary provides the requirement. When the requirement or a
 * diff source is missing, it returns `missing_input` with a precise message
 * rather than fabricating a diff or spec.
 */
import type { AnalysisResult } from '../analysis/index.js';
import type { MemoryStore } from '../memory/index.js';
import { toMemoryProjectId } from '../memory/index.js';
import { handleAnalyze } from '../ui/handleAnalyze.js';
import { handleSaveMemory } from '../ui/handleSaveMemory.js';
import { handleClearMemory } from '../ui/handleClearMemory.js';
import { handleWriteNotion } from '../ui/handleWriteNotion.js';
import { UiSessionStore } from '../ui/sessionStore.js';
import type {
  AnalysisRunner,
  UiMode,
  SaveMemoryResponse,
  ClearMemoryResponse,
  WriteNotionResponse,
} from '../ui/types.js';
import type { FetchLike } from '../ui/normalizeInput.js';
import type { NotionWriteBackService, NotionWriteBackSource } from '../notion/index.js';
import type { TelegramArtifactKind, TelegramSaveSource } from './types.js';

/** Configured default sources Telegram can fall back to (never invents inputs). */
export interface TelegramSourceDefaults {
  githubPrUrl?: string;
  notionPageId?: string;
}

/** A request to run/reuse analysis and generate one artifact from Telegram. */
export interface TelegramGenerationRequest {
  artifact: TelegramArtifactKind;
  userId: string;
  projectName?: string;
  /** Pasted requirement/spec text (source of truth when present). */
  inlineSpec?: string;
  /** Pasted diff text (source of truth when present). */
  inlineDiff?: string;
  /** Reuse a prior session's inputs so only the newly-requested skill runs. */
  reuse?: { sessionId: string; requirementText: string; rawDiff: string };
}

/** The outcome of a Telegram generation request. */
export type TelegramGenerationResult =
  | {
      status: 'success';
      sessionId: string;
      result: AnalysisResult;
      inputs: { requirementText: string; rawDiff: string };
      mode: UiMode;
    }
  | { status: 'missing_input'; message: string }
  | { status: 'error'; message: string };

/** The Telegram → workflow adapter surface used by the command service. */
export interface TelegramWorkflowBridge {
  /** Whether generation is wired on this deployment (a runner is configured). */
  readonly generationAvailable: boolean;
  /** Whether the engine is the real one or a clearly-labeled mock. */
  readonly mode: UiMode;
  generate(request: TelegramGenerationRequest): Promise<TelegramGenerationResult>;
  saveMemory(input: {
    projectName?: string;
    source: TelegramSaveSource;
    sessionId: string;
  }): Promise<SaveMemoryResponse>;
  clearMemory(input: { projectName?: string }): Promise<ClearMemoryResponse>;
  /**
   * Explicit Notion write-back. Optional so existing bridges/fakes stay valid;
   * absent → the command reports that write-back is unavailable. Never invoked
   * automatically — only from an explicit `/notion …` command.
   */
  writeNotion?(input: {
    source: NotionWriteBackSource;
    sessionId?: string;
    projectName?: string;
    pageIdOrUrl?: string;
  }): Promise<WriteNotionResponse>;
}

/** The optional-artifact include flags for one generation request. */
type IncludeFlags = Record<string, boolean>;

const FLAGS_FOR: Record<TelegramArtifactKind, IncludeFlags> = {
  analyze: { includeFlow: true, includeGapReport: true },
  daily: { includeFlow: true, includeGapReport: true, includeDailyWorkGuidance: true },
  technical: { includeFlow: true, includeGapReport: true, includeTechnicalChangeBrief: true },
  demo: { includeFlow: true, includeGapReport: true, includeDemoPrepLoop: true },
  weekly: { includeFlow: true, includeGapReport: true, includeWeeklyReview: true },
};

export class DefaultTelegramWorkflowBridge implements TelegramWorkflowBridge {
  readonly generationAvailable = true;
  readonly mode: UiMode;
  private readonly runner: AnalysisRunner;
  private readonly memoryStore: MemoryStore;
  private readonly sessionStore: UiSessionStore;
  private readonly fetchImpl: FetchLike | undefined;
  private readonly defaults: TelegramSourceDefaults;
  private readonly notionWriteBack: NotionWriteBackService | undefined;

  constructor({
    runner,
    mode,
    memoryStore,
    sessionStore,
    fetchImpl,
    defaults,
    notionWriteBack,
  }: {
    runner: AnalysisRunner;
    mode: UiMode;
    memoryStore: MemoryStore;
    /** Shared cache so `/save` can read the just-generated result. Defaults new. */
    sessionStore?: UiSessionStore;
    fetchImpl?: FetchLike;
    defaults?: TelegramSourceDefaults;
    /** Explicit Notion write-back; absent → `/notion …` reports unavailable. */
    notionWriteBack?: NotionWriteBackService;
  }) {
    this.runner = runner;
    this.mode = mode;
    this.memoryStore = memoryStore;
    this.sessionStore = sessionStore ?? new UiSessionStore();
    this.fetchImpl = fetchImpl;
    this.defaults = defaults ?? {};
    this.notionWriteBack = notionWriteBack;
  }

  async generate(request: TelegramGenerationRequest): Promise<TelegramGenerationResult> {
    const resolved = await this.resolveInputs(request);
    if ('message' in resolved) {
      return { status: 'missing_input', message: resolved.message };
    }

    const body: Record<string, unknown> = {
      inputMode: resolved.inputMode,
      requirementText: resolved.requirementText,
      rawDiff: resolved.rawDiff,
      githubUrl: resolved.githubUrl ?? '',
      ...FLAGS_FOR[request.artifact],
      ...(request.projectName !== undefined ? { projectName: request.projectName } : {}),
      ...(resolved.sessionId !== undefined ? { sessionId: resolved.sessionId } : {}),
    };

    const response = await handleAnalyze({
      runner: this.runner,
      mode: this.mode,
      body,
      store: this.sessionStore,
      memoryStore: this.memoryStore,
      ...(this.fetchImpl !== undefined ? { fetchImpl: this.fetchImpl } : {}),
    });

    if (response.status === 'error') {
      return { status: 'error', message: response.message };
    }

    const result = this.sessionStore.getResult(response.sessionId);
    if (result === undefined) {
      return { status: 'error', message: 'Analysis completed but its result could not be read back.' };
    }
    return {
      status: 'success',
      sessionId: response.sessionId,
      result,
      inputs: response.inputs,
      mode: response.mode,
    };
  }

  saveMemory({
    projectName,
    source,
    sessionId,
  }: {
    projectName?: string;
    source: TelegramSaveSource;
    sessionId: string;
  }): Promise<SaveMemoryResponse> {
    // `handleSaveMemory` speaks the artifact keys, not the short Telegram source.
    const handlerSource = source === 'weekly' ? 'weeklyReview' : 'dailyWorkGuidance';
    return handleSaveMemory({
      memoryStore: this.memoryStore,
      store: this.sessionStore,
      sessionId,
      body: { source: handlerSource, ...(projectName !== undefined ? { projectName } : {}) },
    });
  }

  clearMemory({ projectName }: { projectName?: string }): Promise<ClearMemoryResponse> {
    return handleClearMemory({
      memoryStore: this.memoryStore,
      body: { ...(projectName !== undefined ? { projectName } : {}) },
    });
  }

  /**
   * Explicit Notion write-back for the `/notion …` command. Reuses the SAME
   * handler the UI uses over the bridge's own session cache and memory store,
   * so there is one write path and no duplicated logic. Only ever called from an
   * explicit command — never after generation.
   */
  writeNotion({
    source,
    sessionId,
    projectName,
    pageIdOrUrl,
  }: {
    source: NotionWriteBackSource;
    sessionId?: string;
    projectName?: string;
    pageIdOrUrl?: string;
  }): Promise<WriteNotionResponse> {
    if (this.notionWriteBack === undefined) {
      return Promise.resolve({
        status: 'error',
        message:
          'Notion write-back is not configured. Set SOURCE_INTEGRATIONS_ENABLED=true, NOTION_API_KEY, and NOTION_DEFAULT_PAGE_ID.',
      });
    }
    return handleWriteNotion({
      notionWriteBack: this.notionWriteBack,
      store: this.sessionStore,
      memoryStore: this.memoryStore,
      sessionId: sessionId ?? '',
      body: {
        source,
        ...(projectName !== undefined ? { projectName } : {}),
        ...(pageIdOrUrl !== undefined ? { pageIdOrUrl } : {}),
      },
    });
  }

  /**
   * Resolve the requirement + diff + input mode for a run, or a `missing_input`
   * message. Explicit pasted text wins; otherwise a reused session's inputs, then
   * configured defaults + saved memory fill the gaps. Never fabricates inputs.
   */
  private async resolveInputs(
    request: TelegramGenerationRequest,
  ): Promise<
    | { requirementText: string; rawDiff: string; inputMode: string; githubUrl?: string; sessionId?: string }
    | { message: string }
  > {
    // Reuse a prior session verbatim (same inputs) so only the new skill runs.
    if (request.reuse !== undefined) {
      return {
        requirementText: request.reuse.requirementText,
        rawDiff: request.reuse.rawDiff,
        inputMode: 'manual',
        sessionId: request.reuse.sessionId,
      };
    }

    const requirementText =
      trimToUndefined(request.inlineSpec) ?? (await this.savedSpecSummary(request));
    const inlineDiff = trimToUndefined(request.inlineDiff);
    const githubPrUrl = trimToUndefined(this.defaults.githubPrUrl);

    const missing: string[] = [];
    if (requirementText === undefined) missing.push('a requirement/spec');
    if (inlineDiff === undefined && githubPrUrl === undefined) missing.push('a code diff');

    if (missing.length > 0 || requirementText === undefined) {
      return { message: this.missingInputMessage(missing) };
    }

    if (inlineDiff !== undefined) {
      return { requirementText, rawDiff: inlineDiff, inputMode: 'manual' };
    }
    if (githubPrUrl !== undefined) {
      // A configured GitHub PR/commit URL: handleAnalyze fetches the .diff for us.
      return { requirementText, rawDiff: '', inputMode: 'githubUrl', githubUrl: githubPrUrl };
    }
    return { message: this.missingInputMessage(missing) };
  }

  private async savedSpecSummary(request: TelegramGenerationRequest): Promise<string | undefined> {
    if (request.projectName === undefined) return undefined;
    const projectId = toMemoryProjectId(request.projectName);
    if (projectId === undefined) return undefined;
    try {
      const memory = await this.memoryStore.getProjectMemory({ userId: request.userId, projectId });
      return trimToUndefined(memory?.activeSpecSummary);
    } catch {
      // Memory is supporting context only; a load error must not block generation.
      return undefined;
    }
  }

  private missingInputMessage(missing: string[]): string {
    const lead =
      missing.length > 0
        ? `I can't run analysis yet — I'm missing ${missing.join(' and ')}.`
        : 'I need a project name and either configured GitHub/Notion sources or pasted spec/diff text.';
    return [
      lead,
      '',
      'Provide input directly, e.g.:',
      '/analyze spec: <your requirement> diff: <your unified diff>',
      '',
      'Or configure defaults: set GITHUB_DEFAULT_PR_URL for the diff and save an active spec summary to project memory for the requirement.',
    ].join('\n');
  }
}

function trimToUndefined(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}
