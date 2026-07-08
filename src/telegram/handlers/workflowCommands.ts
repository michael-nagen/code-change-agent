/**
 * Workflow command handlers: analysis, on-demand generation, and memory writes.
 *
 * All heavy lifting is delegated to the injected `bridge`, which calls the SAME
 * UI server handlers (`handleAnalyze` / `handleSaveMemory` / `handleClearMemory`
 * / `handleWriteNotion`). These handlers only orchestrate: resolve inputs/project,
 * show progress, persist lightweight control state, and format the reply.
 */
import { plainReply } from '../reply.js';
import { clearConfirmKeyboard, generationKeyboard, saveKeyboard } from '../keyboards.js';
import { parseConfirmFlag, parseInlineSpecDiff, parseSaveSource } from '../parseTelegramCommand.js';
import {
  formatAnalyzeSummary,
  formatDailyGuidance,
  formatDemoPrep,
  formatTechnicalBrief,
  formatWeeklyReview,
} from '../formatTelegramResponse.js';
import type { NotionWriteBackSource } from '../../notion/index.js';
import type { TelegramWorkflowBridge } from '../TelegramWorkflowBridge.js';
import type {
  TelegramArtifactKind,
  TelegramArtifactRef,
  TelegramReply,
  TelegramReplyMarkup,
  TelegramSaveSource,
} from '../types.js';
import { resolveProject, type CommandHandler, type HandlerContext } from './context.js';

const GENERATION_UNAVAILABLE =
  'Generation is not configured on this deployment. Set UI_MODE=real with OPENAI_API_KEY (or run in mock mode) to enable /analyze, /daily, /technical, /demo, and /weekly.';

const PROGRESS_LABEL: Record<TelegramArtifactKind, string> = {
  analyze: '🔄 Running analysis…',
  daily: '🔄 Generating Daily Work Guidance…',
  technical: '🔄 Generating Technical Change Brief…',
  demo: '🔄 Preparing demo / presentation…',
  weekly: '🔄 Generating Weekly Review…',
};

const NOTION_SUBCOMMANDS: Record<string, NotionWriteBackSource> = {
  daily: 'dailyWorkGuidance',
  weekly: 'weeklyReview',
  demo: 'demoPrepLoop',
  memory: 'projectMemory',
};

function makeGenerateHandler(artifact: TelegramArtifactKind): CommandHandler {
  return (ctx) => generate(ctx, artifact);
}

export const analyzeHandler = makeGenerateHandler('analyze');
export const dailyHandler = makeGenerateHandler('daily');
export const technicalHandler = makeGenerateHandler('technical');
export const demoHandler = makeGenerateHandler('demo');
export const weeklyHandler = makeGenerateHandler('weekly');

async function generate(ctx: HandlerContext, artifact: TelegramArtifactKind): Promise<TelegramReply> {
  const bridge = ctx.bridge;
  if (bridge === undefined || !bridge.generationAvailable) {
    return plainReply(GENERATION_UNAVAILABLE);
  }

  const inline = parseInlineSpecDiff(ctx.argsText);
  const state = ctx.state.get(ctx.chatId);
  const projectLabel = inline.projectName ?? state.activeProject ?? ctx.config.defaultProject;

  const wantsReuse =
    inline.projectName === undefined &&
    inline.spec === undefined &&
    inline.diff === undefined &&
    state.lastSessionId !== undefined &&
    state.lastInputs !== undefined;

  await ctx.progress(PROGRESS_LABEL[artifact]);

  const result = await bridge.generate({
    artifact,
    userId: ctx.userId,
    ...(projectLabel !== undefined ? { projectName: projectLabel } : {}),
    ...(inline.spec !== undefined ? { inlineSpec: inline.spec } : {}),
    ...(inline.diff !== undefined ? { inlineDiff: inline.diff } : {}),
    ...(wantsReuse && state.lastSessionId !== undefined && state.lastInputs !== undefined
      ? { reuse: { sessionId: state.lastSessionId, ...state.lastInputs } }
      : {}),
  });

  if (result.status === 'missing_input') return plainReply(result.message);
  if (result.status === 'error') return plainReply(`Sorry, analysis failed: ${result.message}`);

  const label = projectLabel ?? 'your change';
  const text = formatArtifact({ artifact, label, result });

  ctx.state.update(ctx.chatId, {
    lastSessionId: result.sessionId,
    lastInputs: result.inputs,
    lastArtifact: artifact,
    lastArtifactText: text,
    lastArtifactProject: label,
    ...(inline.projectName !== undefined ? { activeProject: inline.projectName } : {}),
    ...(artifact === 'daily' ? { pendingSaveSource: 'daily' as TelegramSaveSource } : {}),
    ...(artifact === 'weekly' ? { pendingSaveSource: 'weekly' as TelegramSaveSource } : {}),
  });

  const ref: TelegramArtifactRef = {
    artifact,
    text,
    projectLabel: label,
    sessionId: result.sessionId,
  };
  // `artifact` lets the webhook register every rendered message id so a later
  // reply to this result (even a split chunk) resolves it for editing.
  return { ...plainReply(text, keyboardFor(artifact)), artifact: ref };
}

function keyboardFor(artifact: TelegramArtifactKind): { replyMarkup?: TelegramReplyMarkup } {
  if (artifact === 'analyze') return { replyMarkup: generationKeyboard() };
  if (artifact === 'daily') return { replyMarkup: saveKeyboard('daily') };
  if (artifact === 'weekly') return { replyMarkup: saveKeyboard('weekly') };
  return {};
}

type GenerationSuccess = Extract<
  Awaited<ReturnType<TelegramWorkflowBridge['generate']>>,
  { status: 'success' }
>;

function formatArtifact({
  artifact,
  label,
  result,
}: {
  artifact: TelegramArtifactKind;
  label: string;
  result: GenerationSuccess;
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

export const saveHandler: CommandHandler = async (ctx) => {
  const bridge = ctx.bridge;
  if (bridge === undefined) return plainReply(GENERATION_UNAVAILABLE);

  const state = ctx.state.get(ctx.chatId);
  const source: TelegramSaveSource | undefined = parseSaveSource(ctx.args) ?? state.pendingSaveSource;
  if (source === undefined || state.lastSessionId === undefined) {
    return plainReply('No pending memory update. Generate /daily or /weekly first, then send /save.');
  }

  const projectLabel = state.activeProject ?? ctx.config.defaultProject;
  const response = await bridge.saveMemory({
    source,
    sessionId: state.lastSessionId,
    ...(projectLabel !== undefined ? { projectName: projectLabel } : {}),
  });
  return plainReply(response.message);
};

export const clearHandler: CommandHandler = async (ctx) => {
  const bridge = ctx.bridge;
  if (bridge === undefined) return plainReply(GENERATION_UNAVAILABLE);

  const resolved = resolveProject(ctx, '');
  if (resolved === undefined) {
    return plainReply(
      'Set a project first ("/project <name>" or TELEGRAM_DEFAULT_PROJECT) before clearing memory.',
    );
  }

  if (!parseConfirmFlag(ctx.args)) {
    ctx.state.update(ctx.chatId, { pendingClear: true });
    return plainReply(
      `This will clear project memory for "${resolved.label}". Confirm below (or send "/clear confirm"). Your prompt/working preferences are NOT affected.`,
      { replyMarkup: clearConfirmKeyboard() },
    );
  }

  const response = await bridge.clearMemory({ projectName: resolved.label });
  if (response.status === 'error') return plainReply(response.message);
  ctx.state.update(ctx.chatId, { pendingClear: false });
  return plainReply(
    `Cleared project memory for "${resolved.label}". Your prompt/working preferences are untouched.`,
  );
};

export const notionHandler: CommandHandler = async (ctx) => {
  const bridge = ctx.bridge;
  if (bridge === undefined || bridge.writeNotion === undefined) {
    return plainReply('Notion write-back is not configured on this deployment.');
  }
  const write = bridge.writeNotion.bind(bridge);

  const sub = (ctx.args[0] ?? '').toLowerCase();
  const source = NOTION_SUBCOMMANDS[sub];
  if (source === undefined) {
    return plainReply('Usage: /notion daily | weekly | demo | memory');
  }

  const state = ctx.state.get(ctx.chatId);
  const projectLabel = state.activeProject ?? ctx.config.defaultProject;

  if (source === 'projectMemory') {
    if (projectLabel === undefined || projectLabel.trim() === '') {
      return plainReply(
        'Set a project first ("/project <name>" or TELEGRAM_DEFAULT_PROJECT) before sending a memory snapshot to Notion.',
      );
    }
    const response = await write({ source, projectName: projectLabel });
    return plainReply(response.status === 'success' ? 'Sent to Notion.' : response.message);
  }

  if (state.lastSessionId === undefined) {
    return plainReply(`No ${sub} artifact yet. Generate /${sub} first, then run /notion ${sub}.`);
  }
  const response = await write({
    source,
    sessionId: state.lastSessionId,
    ...(projectLabel !== undefined ? { projectName: projectLabel } : {}),
  });
  return plainReply(response.status === 'success' ? 'Sent to Notion.' : response.message);
};
