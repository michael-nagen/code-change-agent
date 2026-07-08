/**
 * Builds the `MemoryStatus` shown in the Project Memory panel from the durable
 * MemoryStore. This makes stored memory a visible product capability rather than
 * a hidden context injection.
 *
 * It reads only via the storage-agnostic `MemoryStore` interface. A load error
 * (e.g. a corrupted file) is surfaced in `loadError` rather than crashing.
 */
import type { MemoryStore } from '../memory/index.js';
import { resolveUserId, toMemoryProjectId } from '../memory/index.js';
import { MemoryStoreError } from '../errors/MemoryStoreError.js';
import type { MemoryStatus } from './types.js';

export async function buildMemoryStatus({
  memoryStore,
  projectName,
  activeSpecSummary,
  markLoaded,
}: {
  memoryStore: MemoryStore;
  projectName?: string;
  activeSpecSummary?: string;
  /** When true, a present snapshot is reported as loaded for this run. */
  markLoaded: boolean;
}): Promise<MemoryStatus> {
  const userId = resolveUserId();
  const projectId = projectName !== undefined ? toMemoryProjectId(projectName) : undefined;

  const base: MemoryStatus = {
    loadedForThisRun: false,
    ...(projectName !== undefined && projectName.trim() !== '' ? { projectName } : {}),
    ...(projectId !== undefined ? { projectId } : {}),
    ...(activeSpecSummary !== undefined && activeSpecSummary.trim() !== ''
      ? { activeSpecSummary }
      : {}),
  };

  // Personal working preferences are user-level (cross-project), so load them
  // regardless of whether there is a project. A preferences load error is
  // surfaced but never blocks the rest of the status.
  try {
    const userMemory = await memoryStore.getUserMemory({ userId });
    if (userMemory?.promptPreferences !== undefined) {
      base.promptPreferences = userMemory.promptPreferences;
    }
  } catch (err) {
    base.loadError = err instanceof MemoryStoreError ? err.message : String(err);
  }

  if (projectId === undefined) {
    return base;
  }

  try {
    const memory = await memoryStore.getProjectMemory({ userId, projectId });
    if (memory === undefined) {
      return base;
    }
    // A user-edited spec summary stored on the project takes precedence over the
    // run-derived one.
    if (memory.activeSpecSummary !== undefined && memory.activeSpecSummary.trim() !== '') {
      base.activeSpecSummary = memory.activeSpecSummary;
    }
    const snapshot = memory.latestSnapshot;
    if (snapshot === undefined) {
      return base;
    }
    return {
      ...base,
      loadedForThisRun: markLoaded,
      snapshot: {
        latestSummary: snapshot.dailySummary,
        date: snapshot.date,
        checklistStatuses: snapshot.updatedChecklistStatuses.map((c) => ({
          item: c.item,
          status: c.status,
        })),
        decisions: [...snapshot.openDecisions],
        blockers: [...snapshot.openBlockers],
        nextActions: [...snapshot.nextActions],
        updatedAt: memory.updatedAt,
        ...(snapshot.loopStage !== undefined ? { loopStage: snapshot.loopStage } : {}),
        ...(snapshot.planDecisions !== undefined
          ? {
              planDecisions: snapshot.planDecisions.map((d) => ({
                itemId: d.itemId,
                action: d.action,
                text: d.text,
                ...(d.note !== undefined ? { note: d.note } : {}),
              })),
            }
          : {}),
      },
    };
  } catch (err) {
    const loadError = err instanceof MemoryStoreError ? err.message : String(err);
    return { ...base, loadError };
  }
}
