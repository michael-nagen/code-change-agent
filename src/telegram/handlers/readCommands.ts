/**
 * Read-only command handlers: they read the shared MemoryStore and per-chat
 * control state and format concise replies. No generation, no memory writes.
 */
import { plainReply } from '../reply.js';
import { mainMenuKeyboard, projectsKeyboard } from '../keyboards.js';
import {
  formatBlockers,
  formatHelp,
  formatNextActions,
  formatPreferences,
  formatStart,
} from '../formatTelegramResponse.js';
import {
  formatMemorySnapshot,
  formatProjectStatus,
  formatProjectSummary,
  formatProjectsList,
} from '../formatStatus.js';
import {
  currentProjectLabel,
  errorText,
  loadProjectMemory,
  noProjectMessage,
  resolveProject,
  type CommandHandler,
} from './context.js';

export const startHandler: CommandHandler = async (ctx) => {
  const text = formatStart({
    ...(ctx.config.defaultProject !== undefined
      ? { defaultProject: ctx.config.defaultProject }
      : {}),
    generationAvailable: ctx.bridge?.generationAvailable ?? false,
    mode: ctx.bridge?.mode ?? 'mock',
  });
  return plainReply(text, { replyMarkup: mainMenuKeyboard() });
};

export const helpHandler: CommandHandler = async () => plainReply(formatHelp());

export const statusHandler: CommandHandler = async (ctx) => {
  const resolved = resolveProject(ctx);
  if (resolved === undefined) return plainReply(noProjectMessage());
  const memory = await loadProjectMemory(ctx, resolved.projectId);
  if (typeof memory === 'string') return plainReply(memory);
  return plainReply(formatProjectStatus({ projectLabel: resolved.label, memory }));
};

export const memoryHandler: CommandHandler = async (ctx) => {
  const resolved = resolveProject(ctx);
  if (resolved === undefined) return plainReply(noProjectMessage());
  const memory = await loadProjectMemory(ctx, resolved.projectId);
  if (typeof memory === 'string') return plainReply(memory);
  return plainReply(formatMemorySnapshot({ projectLabel: resolved.label, memory }));
};

export const summaryHandler: CommandHandler = async (ctx) => {
  const resolved = resolveProject(ctx);
  if (resolved === undefined) return plainReply(noProjectMessage());
  const memory = await loadProjectMemory(ctx, resolved.projectId);
  if (typeof memory === 'string') return plainReply(memory);
  return plainReply(formatProjectSummary({ projectLabel: resolved.label, memory }));
};

export const nextHandler: CommandHandler = async (ctx) => {
  const resolved = resolveProject(ctx, '');
  if (resolved === undefined) return plainReply(noProjectMessage());
  const memory = await loadProjectMemory(ctx, resolved.projectId);
  if (typeof memory === 'string') return plainReply(memory);
  return plainReply(formatNextActions({ projectLabel: resolved.label, memory }));
};

export const blockersHandler: CommandHandler = async (ctx) => {
  const resolved = resolveProject(ctx, '');
  if (resolved === undefined) return plainReply(noProjectMessage());
  const memory = await loadProjectMemory(ctx, resolved.projectId);
  if (typeof memory === 'string') return plainReply(memory);
  return plainReply(formatBlockers({ projectLabel: resolved.label, memory }));
};

export const preferencesHandler: CommandHandler = async (ctx) => {
  try {
    const userMemory = await ctx.memoryStore.getUserMemory({ userId: ctx.userId });
    return plainReply(formatPreferences(userMemory?.promptPreferences));
  } catch (err) {
    return plainReply(`Could not read preferences: ${errorText(err)}`);
  }
};

export const projectHandler: CommandHandler = async (ctx) => {
  const label = ctx.argsText.trim();
  if (label === '') {
    const current = currentProjectLabel(ctx);
    if (current === undefined) {
      return plainReply(
        'No active project. Set one with "/project <name>", or set TELEGRAM_DEFAULT_PROJECT.',
      );
    }
    return plainReply(`Active project: ${current}`);
  }
  ctx.state.update(ctx.chatId, { activeProject: label });
  return plainReply(
    `Active project set to: ${label}\n\nThis is remembered for this chat. (When unset, TELEGRAM_DEFAULT_PROJECT is used.)`,
  );
};

export const projectsHandler: CommandHandler = async (ctx) => {
  if (ctx.memoryStore.listProjectIds === undefined) {
    return plainReply('Listing projects is not supported by this deployment\'s memory store.');
  }
  let ids: string[];
  try {
    ids = await ctx.memoryStore.listProjectIds({ userId: ctx.userId });
  } catch (err) {
    return plainReply(`Could not list projects: ${errorText(err)}`);
  }
  const activeLabel = currentProjectLabel(ctx);
  const text = formatProjectsList({ projectIds: ids, activeLabel });
  if (ids.length === 0) return plainReply(text);
  return plainReply(text, { replyMarkup: projectsKeyboard(ids) });
};

export const latestHandler: CommandHandler = async (ctx) => {
  const state = ctx.state.get(ctx.chatId);
  if (state.lastArtifactText === undefined || state.lastArtifact === undefined) {
    return plainReply(
      'No generated artifact in this chat yet. Run /analyze, then /daily, /technical, /demo, or /weekly.',
    );
  }
  const project = state.lastArtifactProject ?? currentProjectLabel(ctx) ?? 'your change';
  const header = `Latest: ${state.lastArtifact} — ${project}`;
  // Carry an artifact ref so a reply to `/latest` is editable like the original.
  return {
    ...plainReply(`${header}\n\n${state.lastArtifactText}`),
    artifact: {
      artifact: state.lastArtifact,
      // Edit the artifact body, not the "Latest: …" header prefixed for display.
      text: state.lastArtifactText,
      projectLabel: project,
      ...(state.lastSessionId !== undefined ? { sessionId: state.lastSessionId } : {}),
    },
  };
};
