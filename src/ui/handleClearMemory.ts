/**
 * The clear-memory handler: the explicit, user-confirmed reset for the active
 * project's memory.
 *
 * It clears ONLY the project memory (never user memory) via the storage-agnostic
 * `MemoryStore.clearProjectMemory`, then returns the (now empty) memory status
 * so the Project Memory panel can refresh. It never throws: a missing project
 * name or a storage error is returned as a structured error.
 */
import type { MemoryStore } from '../memory/index.js';
import { resolveUserId, toMemoryProjectId } from '../memory/index.js';
import { MemoryStoreError } from '../errors/MemoryStoreError.js';
import { buildMemoryStatus } from './memoryStatus.js';
import type { ClearMemoryResponse } from './types.js';

export async function handleClearMemory({
  memoryStore,
  body,
}: {
  memoryStore: MemoryStore;
  body: unknown;
}): Promise<ClearMemoryResponse> {
  if (typeof body !== 'object' || body === null) {
    return { status: 'error', message: 'Request body must be a JSON object.' };
  }
  const fields = body as Record<string, unknown>;
  const projectName = typeof fields.projectName === 'string' ? fields.projectName : '';
  const projectId = toMemoryProjectId(projectName);
  if (projectId === undefined) {
    return {
      status: 'error',
      message: 'Set a project name before clearing memory — memory is stored per project.',
    };
  }

  if (memoryStore.clearProjectMemory === undefined) {
    return { status: 'error', message: 'This memory store does not support clearing.' };
  }

  try {
    await memoryStore.clearProjectMemory({ userId: resolveUserId(), projectId });
    const memory = await buildMemoryStatus({ memoryStore, projectName, markLoaded: false });
    return { status: 'success', memory };
  } catch (error) {
    const message =
      error instanceof MemoryStoreError
        ? `Could not clear memory: ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);
    return { status: 'error', message };
  }
}
