/**
 * The write-notion handler: the explicit, user-triggered path that appends a
 * generated artifact (or a saved memory snapshot) to a configured Notion page.
 *
 * It NEVER writes automatically: it runs only when the user clicks "Send to
 * Notion" (UI) or runs an explicit Telegram `/notion …` command. It reads the
 * cached result for the session (daily/weekly/demo) or the saved project memory
 * (memory snapshot), delegates formatting + appending to the
 * `NotionWriteBackService`, and returns a structured result. It never throws:
 * missing config, missing page, missing artifact, and connector/API failures are
 * returned as a structured error whose message is shown verbatim — and never
 * contains the Notion API key.
 */
import { resolveUserId, toMemoryProjectId } from '../memory/index.js';
import type { MemoryStore } from '../memory/index.js';
import {
  isNotionWriteBackSource,
  type NotionWriteBackService,
  type NotionWriteBackSource,
} from '../notion/index.js';
import { NotionWriteBackError } from '../errors/NotionWriteBackError.js';
import { SourceError } from '../errors/SourceError.js';
import { logEvent, runWithTrace, newTraceId } from '../observability/index.js';
import type { UiSessionStore } from './sessionStore.js';
import type { WriteNotionResponse } from './types.js';

interface WriteNotionArgs {
  /** The write service (absent → Notion write-back not wired on this deploy). */
  notionWriteBack?: NotionWriteBackService;
  store: UiSessionStore;
  memoryStore: MemoryStore;
  sessionId: string;
  body: unknown;
}

export async function handleWriteNotion(args: WriteNotionArgs): Promise<WriteNotionResponse> {
  return runWithTrace({ traceId: newTraceId(), sessionId: args.sessionId }, () => writeNotion(args));
}

async function writeNotion({
  notionWriteBack,
  store,
  memoryStore,
  sessionId,
  body,
}: WriteNotionArgs): Promise<WriteNotionResponse> {
  if (typeof body !== 'object' || body === null) {
    return { status: 'error', message: 'Request body must be a JSON object.' };
  }
  const fields = body as Record<string, unknown>;

  const sourceRaw = typeof fields.source === 'string' ? fields.source : '';
  if (!isNotionWriteBackSource(sourceRaw)) {
    return {
      status: 'error',
      message: 'Choose a valid Notion target: dailyWorkGuidance, weeklyReview, demoPrepLoop, or projectMemory.',
    };
  }
  const source: NotionWriteBackSource = sourceRaw;

  if (notionWriteBack === undefined || !notionWriteBack.isConfigured()) {
    return {
      status: 'error',
      message:
        'Notion write-back is not configured. Set SOURCE_INTEGRATIONS_ENABLED=true, NOTION_API_KEY, and NOTION_DEFAULT_PAGE_ID.',
    };
  }

  const projectName = typeof fields.projectName === 'string' ? fields.projectName : '';
  const pageIdOrUrl = typeof fields.pageIdOrUrl === 'string' ? fields.pageIdOrUrl.trim() : '';

  try {
    if (source === 'projectMemory') {
      const projectId = toMemoryProjectId(projectName);
      if (projectId === undefined) {
        return {
          status: 'error',
          message: 'Set a project name before sending a memory snapshot — memory is stored per project.',
        };
      }
      const memory = await memoryStore.getProjectMemory({ userId: resolveUserId(), projectId });
      if (memory === undefined) {
        return {
          status: 'error',
          message: `No saved project memory for "${projectName}" yet. Save a snapshot first, then send it to Notion.`,
        };
      }
      const written = await notionWriteBack.write({
        source,
        projectMemory: memory,
        ...(pageIdOrUrl !== '' ? { pageIdOrUrl } : {}),
      });
      return successFor(source, written.title);
    }

    const result = store.getResult(sessionId);
    if (result === undefined) {
      return { status: 'error', message: `Session not found: ${sessionId}` };
    }
    const written = await notionWriteBack.write({
      source,
      result,
      ...(pageIdOrUrl !== '' ? { pageIdOrUrl } : {}),
    });
    return successFor(source, written.title);
  } catch (error) {
    return { status: 'error', message: toSafeMessage(error) };
  }
}

function successFor(source: NotionWriteBackSource, title: string): WriteNotionResponse {
  logEvent({ event: 'notion_write_back', fields: { source } });
  return { status: 'success', message: 'Sent to Notion.', title };
}

/** Map any error to a user-safe message. Connector/config errors are already safe. */
function toSafeMessage(error: unknown): string {
  if (error instanceof NotionWriteBackError) return error.message;
  if (error instanceof SourceError) return `Notion write failed: ${error.message}`;
  if (error instanceof Error) return `Notion write failed: ${error.message}`;
  return `Notion write failed: ${String(error)}`;
}
