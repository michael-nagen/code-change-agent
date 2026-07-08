/**
 * The edit-memory handler: the explicit path that persists user-edited project
 * memory and personal working / prompt preferences.
 *
 * It validates EVERY requested section before writing ANY of them, so a
 * validation failure in one section (e.g. an invalid checklist status) never
 * leaves the other section partially persisted. Malformed JSON, an invalid
 * checklist status, or a missing required field is returned as a structured
 * error and nothing is persisted. Project memory is saved through the project
 * MemoryStore path and preferences through the user memory path — editing one
 * never touches the other. It never affects artifacts already generated in the
 * current session; edits only shape future runs.
 *
 * The two sections live under separate store records, so this guarantees
 * validation-atomicity: the common failure (bad input) writes nothing. A rare
 * I/O error on the second of the two writes can still leave the first written;
 * true cross-record transactions are out of scope for the file/in-memory stores.
 */
import type {
  MemoryStore,
  ProjectMemory,
  ProjectProgressSnapshot,
  PromptPreferences,
  UserPreferencesMemory,
} from '../memory/index.js';
import {
  MEMORY_SCHEMA_VERSION,
  resolveUserId,
  toMemoryProjectId,
  validatePromptPreferences,
} from '../memory/index.js';
import { MemoryStoreError } from '../errors/MemoryStoreError.js';
import { buildMemoryStatus } from './memoryStatus.js';
import type { EditableProjectMemory, EditMemoryResponse } from './types.js';

/**
 * Checklist statuses accepted from the editor. This is intentionally the union
 * of the product enum (`not_started | partial | done | blocked | unclear`) and
 * the status the daily-guidance skill emits (`missing`), so a user can re-save
 * a snapshot that was seeded from Daily Work Guidance without hitting a false
 * validation error.
 */
const ALLOWED_CHECKLIST_STATUSES = new Set([
  'not_started',
  'partial',
  'done',
  'blocked',
  'unclear',
  'missing',
]);

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function trimmedList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter((v) => v !== '');
}

/** Build the durable snapshot from the editable projection, or an error. */
function buildSnapshot({
  edit,
  existing,
  now,
}: {
  edit: EditableProjectMemory;
  existing: ProjectMemory | undefined;
  now: string;
}): { snapshot?: ProjectProgressSnapshot } | { error: string } {
  const dailySummary = trimmed(edit.dailySummary);
  const decisions = trimmedList(edit.decisions);
  const blockers = trimmedList(edit.blockers);
  const nextActions = trimmedList(edit.nextActions);

  const checklistRaw = Array.isArray(edit.checklist) ? edit.checklist : [];
  const checklist: { item: string; status: string }[] = [];
  for (const entry of checklistRaw) {
    const item = trimmed(entry?.item);
    const status = trimmed(entry?.status);
    if (item === '' && status === '') continue;
    if (item === '') {
      return { error: 'Every checklist item needs a non-empty name.' };
    }
    if (!ALLOWED_CHECKLIST_STATUSES.has(status)) {
      return {
        error: `Invalid checklist status "${status}" for "${item}". Use one of: not_started, partial, done, blocked, unclear.`,
      };
    }
    checklist.push({ item, status });
  }

  const hasContent =
    dailySummary !== '' ||
    checklist.length > 0 ||
    decisions.length > 0 ||
    blockers.length > 0 ||
    nextActions.length > 0;

  if (!hasContent) {
    // Nothing snapshot-worthy in the edit: preserve any existing snapshot.
    return existing?.latestSnapshot !== undefined
      ? { snapshot: existing.latestSnapshot }
      : {};
  }

  if (dailySummary === '') {
    return { error: 'A daily summary is required to save project progress.' };
  }

  const date = trimmed(edit.date) || existing?.latestSnapshot?.date || now.slice(0, 10);

  return {
    snapshot: {
      date,
      dailySummary,
      updatedChecklistStatuses: checklist,
      openBlockers: blockers,
      openDecisions: decisions,
      nextActions,
    },
  };
}

/**
 * Validate + assemble the project memory record WITHOUT writing it. Returns the
 * record to persist, `{}` when there is nothing snapshot-worthy to save, or a
 * structured error. Kept write-free so the caller can validate every section
 * before committing any of them.
 */
async function prepareProjectEdit({
  memoryStore,
  userId,
  projectId,
  edit,
  now,
}: {
  memoryStore: MemoryStore;
  userId: string;
  projectId: string;
  edit: EditableProjectMemory;
  now: string;
}): Promise<{ memory?: ProjectMemory } | { error: string }> {
  const existing = await memoryStore.getProjectMemory({ userId, projectId });
  const built = buildSnapshot({ edit, existing, now });
  if ('error' in built) return { error: built.error };

  const activeSpecSummary = trimmed(edit.activeSpecSummary);
  const resolvedSpecSummary =
    activeSpecSummary !== '' ? activeSpecSummary : existing?.activeSpecSummary;

  const { snapshot } = built;
  if (snapshot === undefined && resolvedSpecSummary === undefined && existing === undefined) {
    // Nothing to persist for the project.
    return {};
  }

  const memory: ProjectMemory = {
    schemaVersion: MEMORY_SCHEMA_VERSION,
    userId,
    projectId,
    history: existing?.history ?? [],
    updatedAt: now,
    ...(resolvedSpecSummary !== undefined ? { activeSpecSummary: resolvedSpecSummary } : {}),
    ...(snapshot !== undefined ? { latestSnapshot: snapshot } : {}),
  };

  return { memory };
}

/**
 * Validate + assemble the user preferences record WITHOUT writing it. Returns
 * the record to persist or a structured error (fails closed on malformed
 * preference data). Write-free so the caller can validate every section before
 * committing any of them.
 */
async function preparePreferencesEdit({
  memoryStore,
  userId,
  preferences,
  now,
}: {
  memoryStore: MemoryStore;
  userId: string;
  preferences: unknown;
  now: string;
}): Promise<{ memory: UserPreferencesMemory } | { error: string }> {
  let validated: PromptPreferences;
  try {
    validated = validatePromptPreferences(preferences);
  } catch (err) {
    return { error: err instanceof MemoryStoreError ? err.message : String(err) };
  }
  const existing = await memoryStore.getUserMemory({ userId });
  const memory: UserPreferencesMemory = {
    schemaVersion: MEMORY_SCHEMA_VERSION,
    userId,
    preferences: existing?.preferences ?? [],
    updatedAt: now,
    ...(existing?.defaultGoal !== undefined ? { defaultGoal: existing.defaultGoal } : {}),
    promptPreferences: validated,
  };
  return { memory };
}

export async function handleEditMemory({
  memoryStore,
  body,
}: {
  memoryStore: MemoryStore;
  body: unknown;
}): Promise<EditMemoryResponse> {
  if (typeof body !== 'object' || body === null) {
    return { status: 'error', message: 'Request body must be a JSON object.' };
  }
  const fields = body as Record<string, unknown>;
  const projectName = typeof fields.projectName === 'string' ? fields.projectName : '';
  const hasProject = fields.project !== undefined && fields.project !== null;
  const hasPreferences = fields.preferences !== undefined && fields.preferences !== null;

  if (!hasProject && !hasPreferences) {
    return { status: 'error', message: 'Nothing to save — provide project memory or preferences.' };
  }

  const userId = resolveUserId();
  const now = new Date().toISOString();
  const savedParts: string[] = [];

  try {
    // PHASE 1 — validate + assemble every requested section. No writes happen
    // here, so a validation failure in either section aborts the whole edit
    // with nothing persisted (validation-atomic).
    let preferencesToSave: UserPreferencesMemory | undefined;
    if (hasPreferences) {
      const prepared = await preparePreferencesEdit({
        memoryStore,
        userId,
        preferences: fields.preferences,
        now,
      });
      if ('error' in prepared) {
        return { status: 'error', message: prepared.error };
      }
      preferencesToSave = prepared.memory;
    }

    let projectToSave: { projectId: string; memory: ProjectMemory } | undefined;
    if (hasProject) {
      const projectId = toMemoryProjectId(projectName);
      if (projectId === undefined) {
        return {
          status: 'error',
          message: 'Set a project name before saving project memory — memory is stored per project.',
        };
      }
      const prepared = await prepareProjectEdit({
        memoryStore,
        userId,
        projectId,
        edit: fields.project as EditableProjectMemory,
        now,
      });
      if ('error' in prepared) {
        return { status: 'error', message: prepared.error };
      }
      if (prepared.memory !== undefined) {
        projectToSave = { projectId, memory: prepared.memory };
      }
    }

    // PHASE 2 — commit. Every section validated above, so these writes fail
    // only on rare I/O errors (handled below).
    if (preferencesToSave !== undefined) {
      await memoryStore.saveUserMemory({ userId, memory: preferencesToSave });
      savedParts.push('preferences');
    }
    if (projectToSave !== undefined) {
      await memoryStore.saveProjectMemory({
        userId,
        projectId: projectToSave.projectId,
        memory: projectToSave.memory,
      });
      savedParts.push('project memory');
    }
  } catch (error) {
    const message =
      error instanceof MemoryStoreError
        ? `Could not save memory: ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);
    return { status: 'error', message };
  }

  const memory = await buildMemoryStatus({
    memoryStore,
    ...(projectName.trim() !== '' ? { projectName } : {}),
    markLoaded: false,
  });

  const message =
    savedParts.length > 0
      ? `Saved ${savedParts.join(' and ')}. It will inform the next run.`
      : 'No changes to save.';

  return { status: 'success', message, memory };
}
