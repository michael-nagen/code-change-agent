/**
 * Executes Telegram commands by calling the EXISTING product services.
 *
 * It stays thin: it resolves the active project, reads/writes lightweight
 * per-chat control state, reads the same `MemoryStore` the UI uses, and delegates
 * ALL analysis, generation, and memory writes to the injected
 * `TelegramWorkflowBridge` (which itself calls the UI's server handlers). It
 * contains NO reasoning and runs NO LLM logic directly.
 *
 * Authorization and the webhook secret are handled upstream at the webhook
 * boundary, not here.
 */
import type { MemoryStore, ProjectMemory } from '../memory/index.js';
import { resolveUserId, toMemoryProjectId } from '../memory/index.js';
import { MemoryStoreError } from '../errors/MemoryStoreError.js';
import { formatMemorySnapshot, formatProjectStatus } from './formatStatus.js';
import {
  parseInlineSpecDiff,
  parseConfirmFlag,
  parseSaveSource,
} from './parseTelegramCommand.js';
import {
  formatHelp,
  formatStart,
  formatPreferences,
  formatNextActions,
  formatBlockers,
  formatAnalyzeSummary,
  formatDailyGuidance,
  formatTechnicalBrief,
  formatDemoPrep,
  formatWeeklyReview,
} from './formatTelegramResponse.js';
import type { TelegramWorkflowBridge } from './TelegramWorkflowBridge.js';
import type { NotionWriteBackSource } from '../notion/index.js';
import { InMemoryTelegramStateStore } from './TelegramStateStore.js';
import type {
  TelegramArtifactKind,
  TelegramConfig,
  TelegramSaveSource,
  TelegramStateStore,
} from './types.js';

const GENERATION_UNAVAILABLE =
  'Generation is not configured on this deployment. Set UI_MODE=real with OPENAI_API_KEY (or run in mock mode) to enable /analyze, /daily, /technical, /demo, and /weekly.';

/** Maps a `/notion <sub>` word to the write-back source it targets. */
const NOTION_SUBCOMMANDS: Record<string, NotionWriteBackSource> = {
  daily: 'dailyWorkGuidance',
  weekly: 'weeklyReview',
  demo: 'demoPrepLoop',
  memory: 'projectMemory',
};

export class TelegramCommandService {
  private readonly memoryStore: MemoryStore;
  private readonly config: TelegramConfig;
  private readonly userId: string;
  private readonly bridge: TelegramWorkflowBridge | undefined;
  private readonly stateStore: TelegramStateStore;

  constructor({
    memoryStore,
    config,
    userId,
    bridge,
    stateStore,
  }: {
    memoryStore: MemoryStore;
    config: TelegramConfig;
    userId?: string;
    /** The workflow adapter. Absent → generation/save/clear report unavailable. */
    bridge?: TelegramWorkflowBridge;
    stateStore?: TelegramStateStore;
  }) {
    this.memoryStore = memoryStore;
    this.config = config;
    this.userId = userId ?? resolveUserId();
    this.bridge = bridge;
    this.stateStore = stateStore ?? new InMemoryTelegramStateStore();
  }

  /**
   * Run a raw command line for a chat. `argsText` is the raw remainder after the
   * command; `chatId` keys the per-chat control state.
   */
  async run({
    command,
    argsText,
    chatId,
  }: {
    command: string;
    argsText: string;
    chatId: number | string;
  }): Promise<string> {
    const args = argsText.split(/\s+/).filter((a) => a !== '');
    switch (command) {
      case 'start':
        return formatStart({
          ...(this.config.defaultProject !== undefined
            ? { defaultProject: this.config.defaultProject }
            : {}),
          generationAvailable: this.bridge?.generationAvailable ?? false,
          mode: this.bridge?.mode ?? 'mock',
        });
      case 'help':
        return formatHelp();
      case 'status':
        return this.status(argsText, chatId);
      case 'memory':
        return this.memory(argsText, chatId);
      case 'next':
        return this.nextActions(chatId);
      case 'blockers':
        return this.blockers(chatId);
      case 'preferences':
        return this.preferences();
      case 'project':
        return this.project(argsText, chatId);
      case 'analyze':
        return this.generate('analyze', argsText, chatId);
      case 'daily':
        return this.generate('daily', argsText, chatId);
      case 'technical':
        return this.generate('technical', argsText, chatId);
      case 'demo':
        return this.generate('demo', argsText, chatId);
      case 'weekly':
        return this.generate('weekly', argsText, chatId);
      case 'save':
        return this.save(args, chatId);
      case 'notion':
      case 'send-notion':
        return this.notion(args, chatId);
      case 'clear':
        return this.clear(args, chatId);
      default:
        return `Unknown command: /${command}\n\n${formatHelp()}`;
    }
  }

  private async status(argsText: string, chatId: number | string): Promise<string> {
    const resolved = this.resolveProject(argsText, chatId);
    if (resolved === undefined) return this.noProjectMessage();
    const memory = await this.loadProjectMemory(resolved.projectId);
    if (typeof memory === 'string') return memory;
    return formatProjectStatus({ projectLabel: resolved.label, memory });
  }

  private async memory(argsText: string, chatId: number | string): Promise<string> {
    const resolved = this.resolveProject(argsText, chatId);
    if (resolved === undefined) return this.noProjectMessage();
    const memory = await this.loadProjectMemory(resolved.projectId);
    if (typeof memory === 'string') return memory;
    return formatMemorySnapshot({ projectLabel: resolved.label, memory });
  }

  private async nextActions(chatId: number | string): Promise<string> {
    const resolved = this.resolveProject('', chatId);
    if (resolved === undefined) return this.noProjectMessage();
    const memory = await this.loadProjectMemory(resolved.projectId);
    if (typeof memory === 'string') return memory;
    return formatNextActions({ projectLabel: resolved.label, memory });
  }

  private async blockers(chatId: number | string): Promise<string> {
    const resolved = this.resolveProject('', chatId);
    if (resolved === undefined) return this.noProjectMessage();
    const memory = await this.loadProjectMemory(resolved.projectId);
    if (typeof memory === 'string') return memory;
    return formatBlockers({ projectLabel: resolved.label, memory });
  }

  private async preferences(): Promise<string> {
    try {
      const userMemory = await this.memoryStore.getUserMemory({ userId: this.userId });
      return formatPreferences(userMemory?.promptPreferences);
    } catch (err) {
      return `Could not read preferences: ${errorText(err)}`;
    }
  }

  private project(argsText: string, chatId: number | string): string {
    const label = argsText.trim();
    if (label === '') {
      const current = this.currentProjectLabel(chatId);
      if (current === undefined) {
        return 'No active project. Set one with "/project <name>", or set TELEGRAM_DEFAULT_PROJECT.';
      }
      return `Active project: ${current}`;
    }
    this.stateStore.update(chatId, { activeProject: label });
    return `Active project set to: ${label}\n\nThis is remembered for this chat. (When unset, TELEGRAM_DEFAULT_PROJECT is used.)`;
  }

  private async generate(
    artifact: TelegramArtifactKind,
    argsText: string,
    chatId: number | string,
  ): Promise<string> {
    if (this.bridge === undefined || !this.bridge.generationAvailable) {
      return GENERATION_UNAVAILABLE;
    }

    const inline = parseInlineSpecDiff(argsText);
    const state = this.stateStore.get(chatId);
    const projectLabel = inline.projectName ?? state.activeProject ?? this.config.defaultProject;

    // Reuse the last session (verbatim inputs) when this command adds no new
    // input and does not switch project, so only the new skill runs.
    const wantsReuse =
      inline.projectName === undefined &&
      inline.spec === undefined &&
      inline.diff === undefined &&
      state.lastSessionId !== undefined &&
      state.lastInputs !== undefined;

    const result = await this.bridge.generate({
      artifact,
      userId: this.userId,
      ...(projectLabel !== undefined ? { projectName: projectLabel } : {}),
      ...(inline.spec !== undefined ? { inlineSpec: inline.spec } : {}),
      ...(inline.diff !== undefined ? { inlineDiff: inline.diff } : {}),
      ...(wantsReuse && state.lastSessionId !== undefined && state.lastInputs !== undefined
        ? { reuse: { sessionId: state.lastSessionId, ...state.lastInputs } }
        : {}),
    });

    if (result.status === 'missing_input') return result.message;
    if (result.status === 'error') return `Sorry, analysis failed: ${result.message}`;

    // Remember the session/inputs for follow-up on-demand generation and saves.
    this.stateStore.update(chatId, {
      lastSessionId: result.sessionId,
      lastInputs: result.inputs,
      lastArtifact: artifact,
      ...(inline.projectName !== undefined ? { activeProject: inline.projectName } : {}),
      ...(artifact === 'daily' ? { pendingSaveSource: 'daily' as TelegramSaveSource } : {}),
      ...(artifact === 'weekly' ? { pendingSaveSource: 'weekly' as TelegramSaveSource } : {}),
    });

    const label = projectLabel ?? 'your change';
    return this.formatArtifact({ artifact, label, result });
  }

  private formatArtifact({
    artifact,
    label,
    result,
  }: {
    artifact: TelegramArtifactKind;
    label: string;
    result: Extract<Awaited<ReturnType<TelegramWorkflowBridge['generate']>>, { status: 'success' }>;
  }): string {
    const mode = result.mode;
    switch (artifact) {
      case 'analyze':
        return formatAnalyzeSummary({ projectLabel: label, result: result.result, mode });
      case 'daily':
        return result.result.dailyWorkGuidance !== undefined
          ? formatDailyGuidance({ projectLabel: label, guidance: result.result.dailyWorkGuidance, mode })
          : 'Daily Work Guidance was not produced. Please try again.';
      case 'technical':
        return result.result.technicalChangeBrief !== undefined
          ? formatTechnicalBrief({ projectLabel: label, brief: result.result.technicalChangeBrief, mode })
          : 'Technical Change Brief was not produced. Please try again.';
      case 'demo':
        return result.result.demoPrepLoop !== undefined
          ? formatDemoPrep({ projectLabel: label, demo: result.result.demoPrepLoop, mode })
          : 'Demo Prep Loop was not produced. Please try again.';
      case 'weekly':
        return result.result.weeklyReview !== undefined
          ? formatWeeklyReview({ projectLabel: label, review: result.result.weeklyReview, mode })
          : 'Weekly Review was not produced. Please try again.';
      default: {
        const exhaustive: never = artifact;
        return String(exhaustive);
      }
    }
  }

  private async save(args: string[], chatId: number | string): Promise<string> {
    if (this.bridge === undefined) return GENERATION_UNAVAILABLE;

    const state = this.stateStore.get(chatId);
    const source: TelegramSaveSource | undefined = parseSaveSource(args) ?? state.pendingSaveSource;
    if (source === undefined || state.lastSessionId === undefined) {
      return 'No pending memory update. Generate /daily or /weekly first, then send /save.';
    }

    const projectLabel = state.activeProject ?? this.config.defaultProject;
    const response = await this.bridge.saveMemory({
      source,
      sessionId: state.lastSessionId,
      ...(projectLabel !== undefined ? { projectName: projectLabel } : {}),
    });

    if (response.status === 'error') return response.message;
    return response.message;
  }

  /**
   * Explicit Notion write-back: `/notion daily|weekly|demo|memory`. Never runs
   * automatically from `/daily`, `/weekly`, or `/demo` — the user must run this.
   * Reports clearly when write-back is unavailable, the target is invalid, no
   * artifact/memory exists yet, or Notion config is missing.
   */
  private async notion(args: string[], chatId: number | string): Promise<string> {
    const bridge = this.bridge;
    if (bridge === undefined || bridge.writeNotion === undefined) {
      return 'Notion write-back is not configured on this deployment.';
    }
    const write = bridge.writeNotion.bind(bridge);

    const sub = (args[0] ?? '').toLowerCase();
    const source = NOTION_SUBCOMMANDS[sub];
    if (source === undefined) {
      return 'Usage: /notion daily | weekly | demo | memory';
    }

    const state = this.stateStore.get(chatId);
    const projectLabel = state.activeProject ?? this.config.defaultProject;

    if (source === 'projectMemory') {
      if (projectLabel === undefined || projectLabel.trim() === '') {
        return 'Set a project first ("/project <name>" or TELEGRAM_DEFAULT_PROJECT) before sending a memory snapshot to Notion.';
      }
      const response = await write({ source, projectName: projectLabel });
      return response.status === 'success' ? 'Sent to Notion.' : response.message;
    }

    if (state.lastSessionId === undefined) {
      return `No ${sub} artifact yet. Generate /${sub} first, then run /notion ${sub}.`;
    }
    const response = await write({
      source,
      sessionId: state.lastSessionId,
      ...(projectLabel !== undefined ? { projectName: projectLabel } : {}),
    });
    return response.status === 'success' ? 'Sent to Notion.' : response.message;
  }

  private async clear(args: string[], chatId: number | string): Promise<string> {
    if (this.bridge === undefined) return GENERATION_UNAVAILABLE;

    const resolved = this.resolveProject('', chatId);
    if (resolved === undefined) {
      return 'Set a project first ("/project <name>" or TELEGRAM_DEFAULT_PROJECT) before clearing memory.';
    }

    if (!parseConfirmFlag(args)) {
      this.stateStore.update(chatId, { pendingClear: true });
      return `This will clear project memory for "${resolved.label}". Send "/clear confirm" to proceed. (Your prompt/working preferences are NOT affected.)`;
    }

    const response = await this.bridge.clearMemory({ projectName: resolved.label });
    if (response.status === 'error') return response.message;
    this.stateStore.update(chatId, { pendingClear: false });
    return `Cleared project memory for "${resolved.label}". Your prompt/working preferences are untouched.`;
  }

  /** Resolve a project from explicit args → chat state → configured default. */
  private resolveProject(
    argsText: string,
    chatId: number | string,
  ): { label: string; projectId: string } | undefined {
    const explicit = argsText.trim();
    const label =
      explicit !== ''
        ? explicit
        : (this.stateStore.get(chatId).activeProject ?? this.config.defaultProject);
    if (label === undefined || label.trim() === '') return undefined;
    const projectId = toMemoryProjectId(label);
    if (projectId === undefined) return undefined;
    return { label, projectId };
  }

  private currentProjectLabel(chatId: number | string): string | undefined {
    const label = this.stateStore.get(chatId).activeProject ?? this.config.defaultProject;
    return label !== undefined && label.trim() !== '' ? label : undefined;
  }

  private async loadProjectMemory(
    projectId: string,
  ): Promise<ProjectMemory | undefined | string> {
    try {
      return await this.memoryStore.getProjectMemory({ userId: this.userId, projectId });
    } catch (err) {
      return `Could not read memory: ${errorText(err)}`;
    }
  }

  private noProjectMessage(): string {
    return 'No project specified. Send e.g. "/status my-project", set an active project with "/project <name>", or set TELEGRAM_DEFAULT_PROJECT.';
  }
}

function errorText(err: unknown): string {
  return err instanceof MemoryStoreError ? err.message : String(err);
}
