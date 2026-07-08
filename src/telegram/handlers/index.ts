/**
 * The command REGISTRY + dispatcher.
 *
 * One table maps a command name to its handler and one-line help summary. The
 * dispatcher looks a command up and runs it; unknown commands fall through to a
 * help reply. Inline-button taps and routed natural-language messages resolve to
 * a command name and reuse this exact table, so there is a single dispatch path.
 */
import { plainReply } from '../reply.js';
import { formatHelp } from '../formatTelegramResponse.js';
import type { TelegramReply } from '../types.js';
import type { CommandSpec, HandlerContext } from './context.js';
import {
  blockersHandler,
  helpHandler,
  latestHandler,
  memoryHandler,
  nextHandler,
  preferencesHandler,
  projectHandler,
  projectsHandler,
  startHandler,
  statusHandler,
  summaryHandler,
} from './readCommands.js';
import {
  analyzeHandler,
  clearHandler,
  dailyHandler,
  demoHandler,
  notionHandler,
  saveHandler,
  technicalHandler,
  weeklyHandler,
} from './workflowCommands.js';
import { editHelpHandler } from './editCommands.js';
import {
  moreVideoHandler,
  refreshVideosHandler,
  videoHelpHandler,
  videoTodayHandler,
  videosStatusHandler,
} from './videoCommands.js';

const SPECS: CommandSpec[] = [
  { command: 'start', summary: 'what this bot does', handle: startHandler },
  { command: 'help', summary: 'this list', handle: helpHandler },
  { command: 'status', summary: '[project] latest summary, progress, blockers, next actions', handle: statusHandler },
  { command: 'summary', summary: '[project] a short high-level summary', handle: summaryHandler },
  { command: 'projects', summary: 'list the projects with saved memory', handle: projectsHandler },
  { command: 'project', summary: '[name] show or set the active project', handle: projectHandler },
  { command: 'latest', summary: 'show the last generated artifact', handle: latestHandler },
  { command: 'memory', summary: '[project] compact memory snapshot', handle: memoryHandler },
  { command: 'next', summary: 'next actions only', handle: nextHandler },
  { command: 'blockers', summary: 'open blockers/risks', handle: blockersHandler },
  { command: 'preferences', summary: 'your saved prompt/working preferences', handle: preferencesHandler },
  { command: 'analyze', summary: '[project] [spec: … diff: …] run/reuse analysis', handle: analyzeHandler },
  { command: 'daily', summary: 'generate Daily Work Guidance', handle: dailyHandler },
  { command: 'technical', summary: 'generate Technical Change Brief', handle: technicalHandler },
  { command: 'demo', summary: 'generate Demo Prep Loop', handle: demoHandler },
  { command: 'weekly', summary: 'generate Weekly Review', handle: weeklyHandler },
  { command: 'save', summary: '[daily|weekly] save the latest proposed memory update', handle: saveHandler },
  { command: 'notion', summary: 'daily|weekly|demo|memory — send the latest artifact to Notion', handle: notionHandler },
  { command: 'clear', summary: '[confirm] clear project memory (confirmation required)', handle: clearHandler },
  { command: 'edit', summary: 'how to edit a result (reply to it with your change)', handle: editHelpHandler },
  { command: 'video_today', summary: 'send one unsent AI learning video', handle: videoTodayHandler },
  { command: 'more_video', summary: 'send another unsent video', handle: moreVideoHandler },
  { command: 'videos_status', summary: 'video library counts', handle: videosStatusHandler },
  { command: 'refresh_videos', summary: 'discover and add new videos', handle: refreshVideosHandler },
  { command: 'video_help', summary: 'video commands', handle: videoHelpHandler },
];

/** Alternate spellings that resolve to a registered command. */
const ALIASES: Record<string, string> = {
  'send-notion': 'notion',
  projects_list: 'projects',
};

const REGISTRY = new Map<string, CommandSpec>(SPECS.map((spec) => [spec.command, spec]));

/** Run a command by name, or return a help reply for an unknown command. */
export async function dispatchCommand(command: string, ctx: HandlerContext): Promise<TelegramReply> {
  const name = ALIASES[command] ?? command;
  const spec = REGISTRY.get(name);
  if (spec === undefined) {
    return plainReply(`Unknown command: /${command}\n\n${formatHelp()}`);
  }
  return spec.handle(ctx);
}

/** Whether a command name is known (used to distinguish command vs free text). */
export function isKnownCommand(command: string): boolean {
  return REGISTRY.has(ALIASES[command] ?? command);
}

export type { CommandSpec, HandlerContext } from './context.js';
