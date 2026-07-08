/**
 * The save-memory handler: the explicit, user-confirmed path that persists a
 * run's proposed Daily Work Guidance memory update into durable memory.
 *
 * Model output is NEVER saved automatically — this runs only when the user
 * clicks "Save to memory". It reads the cached result for the session, maps the
 * Daily Work Guidance memory update into a durable project snapshot, appends it
 * to any existing project memory, and writes via the MemoryStore. It never
 * throws: failures (missing session, no guidance, bad project name, storage
 * error) are returned as a structured error whose message is shown verbatim.
 */
import type { MemoryStore, ProjectProgressSnapshot } from '../memory/index.js';
import { appendSnapshot, resolveUserId, toMemoryProjectId } from '../memory/index.js';
import {
  snapshotFromDailyWorkGuidance,
  snapshotFromWeeklyReview,
} from '../analysis/memoryMapping.js';
import { MemoryStoreError } from '../errors/MemoryStoreError.js';
import { logEvent, runWithTrace, newTraceId } from '../observability/index.js';
import { buildMemoryStatus } from './memoryStatus.js';
import type { AnalysisResult } from '../analysis/index.js';
import type { SaveMemoryResponse } from './types.js';
import type { UiSessionStore } from './sessionStore.js';

/** Which artifact's proposed memory update to persist. Defaults to daily. */
type MemorySource = 'dailyWorkGuidance' | 'weeklyReview';

/** Resolve the snapshot to persist from the chosen source, or an error message. */
function resolveSnapshot({
  result,
  source,
}: {
  result: AnalysisResult;
  source: MemorySource;
}): { snapshot: ProjectProgressSnapshot } | { error: string } {
  if (source === 'weeklyReview') {
    if (result.weeklyReview === undefined) {
      return { error: 'Generate the Weekly Review first — there is no memory update to save.' };
    }
    return { snapshot: snapshotFromWeeklyReview(result.weeklyReview) };
  }
  if (result.dailyWorkGuidance === undefined) {
    return {
      error: 'Generate Daily Work Guidance first — there is no proposed memory update to save.',
    };
  }
  return { snapshot: snapshotFromDailyWorkGuidance(result.dailyWorkGuidance) };
}

interface SaveMemoryArgs {
  memoryStore: MemoryStore;
  store: UiSessionStore;
  sessionId: string;
  body: unknown;
}

export async function handleSaveMemory(args: SaveMemoryArgs): Promise<SaveMemoryResponse> {
  return runWithTrace(
    { traceId: newTraceId(), sessionId: args.sessionId },
    () => saveMemory(args),
  );
}

async function saveMemory({
  memoryStore,
  store,
  sessionId,
  body,
}: SaveMemoryArgs): Promise<SaveMemoryResponse> {
  if (typeof body !== 'object' || body === null) {
    return { status: 'error', message: 'Request body must be a JSON object.' };
  }
  const fields = body as Record<string, unknown>;
  const projectName = typeof fields.projectName === 'string' ? fields.projectName : '';
  const source: MemorySource = fields.source === 'weeklyReview' ? 'weeklyReview' : 'dailyWorkGuidance';
  const projectId = toMemoryProjectId(projectName);
  if (projectId === undefined) {
    return {
      status: 'error',
      message: 'Set a project name before saving memory — memory is stored per project.',
    };
  }

  const result = store.getResult(sessionId);
  if (result === undefined) {
    return { status: 'error', message: `Session not found: ${sessionId}` };
  }

  const resolved = resolveSnapshot({ result, source });
  if ('error' in resolved) {
    return { status: 'error', message: resolved.error };
  }
  const { snapshot } = resolved;
  const userId = resolveUserId();

  try {
    const existing = await memoryStore.getProjectMemory({ userId, projectId });
    const memory = appendSnapshot({
      userId,
      projectId,
      snapshot,
      ...(existing !== undefined ? { existing } : {}),
    });
    await memoryStore.saveProjectMemory({ userId, projectId, memory });
    logEvent({
      event: 'memory_saved',
      fields: {
        scope: 'project',
        projectId,
        source,
        snapshotDate: snapshot.date,
        snapshotHistoryCount: memory.history.length,
      },
    });
    const status = await buildMemoryStatus({ memoryStore, projectName, markLoaded: false });
    return {
      status: 'success',
      message: `Saved progress for "${projectName}" (${snapshot.date}). It will inform the next run.`,
      savedDate: snapshot.date,
      memory: status,
    };
  } catch (error) {
    const message =
      error instanceof MemoryStoreError
        ? `Could not save memory: ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);
    return { status: 'error', message };
  }
}
