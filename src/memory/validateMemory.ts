/**
 * Runtime shape validation for memory records.
 *
 * Both the file store (on read) and the in-memory store (on save) validate
 * before trusting a value, so a malformed record never propagates into the app.
 * Validators throw `MemoryStoreError('VALIDATION', …)`; callers that read
 * untrusted persisted data may re-tag failures as `CORRUPTED`.
 */
import { MemoryStoreError } from '../errors/MemoryStoreError.js';
import type {
  ChecklistStatusEntry,
  ProjectMemory,
  ProjectProgressSnapshot,
  UserPreferencesMemory,
} from './types/memory.js';

function asRecord({ raw, label }: { raw: unknown; label: string }): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new MemoryStoreError('VALIDATION', `${label} must be a JSON object.`);
  }
  return raw as Record<string, unknown>;
}

function requireString({
  obj,
  key,
  label,
}: {
  obj: Record<string, unknown>;
  key: string;
  label: string;
}): string {
  const val = obj[key];
  if (typeof val !== 'string' || val.trim() === '') {
    throw new MemoryStoreError('VALIDATION', `${label}.${key} must be a non-empty string.`);
  }
  return val;
}

function requireStringArray({
  obj,
  key,
  label,
}: {
  obj: Record<string, unknown>;
  key: string;
  label: string;
}): string[] {
  const val = obj[key];
  if (!Array.isArray(val)) {
    throw new MemoryStoreError('VALIDATION', `${label}.${key} must be an array.`);
  }
  return val.map((item, i) => {
    if (typeof item !== 'string') {
      throw new MemoryStoreError('VALIDATION', `${label}.${key}[${i}] must be a string.`);
    }
    return item;
  });
}

function requireNumber({
  obj,
  key,
  label,
}: {
  obj: Record<string, unknown>;
  key: string;
  label: string;
}): number {
  const val = obj[key];
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    throw new MemoryStoreError('VALIDATION', `${label}.${key} must be a number.`);
  }
  return val;
}

function optionalString({
  obj,
  key,
  label,
}: {
  obj: Record<string, unknown>;
  key: string;
  label: string;
}): string | undefined {
  const val = obj[key];
  if (val === undefined || val === null) return undefined;
  if (typeof val !== 'string' || val.trim() === '') {
    throw new MemoryStoreError(
      'VALIDATION',
      `${label}.${key} must be a non-empty string when present.`,
    );
  }
  return val;
}

function validateChecklistStatuses({
  obj,
  key,
  label,
}: {
  obj: Record<string, unknown>;
  key: string;
  label: string;
}): ChecklistStatusEntry[] {
  const val = obj[key];
  if (!Array.isArray(val)) {
    throw new MemoryStoreError('VALIDATION', `${label}.${key} must be an array.`);
  }
  return val.map((item, i) => {
    const entryLabel = `${label}.${key}[${i}]`;
    const entry = asRecord({ raw: item, label: entryLabel });
    return {
      item: requireString({ obj: entry, key: 'item', label: entryLabel }),
      status: requireString({ obj: entry, key: 'status', label: entryLabel }),
    };
  });
}

function validateSnapshot({ raw, label }: { raw: unknown; label: string }): ProjectProgressSnapshot {
  const obj = asRecord({ raw, label });
  return {
    date: requireString({ obj, key: 'date', label }),
    dailySummary: requireString({ obj, key: 'dailySummary', label }),
    updatedChecklistStatuses: validateChecklistStatuses({
      obj,
      key: 'updatedChecklistStatuses',
      label,
    }),
    openBlockers: requireStringArray({ obj, key: 'openBlockers', label }),
    openDecisions: requireStringArray({ obj, key: 'openDecisions', label }),
    nextActions: requireStringArray({ obj, key: 'nextActions', label }),
  };
}

export function validateUserPreferencesMemory(raw: unknown): UserPreferencesMemory {
  const label = 'UserPreferencesMemory';
  const obj = asRecord({ raw, label });
  const defaultGoal = optionalString({ obj, key: 'defaultGoal', label });
  return {
    schemaVersion: requireNumber({ obj, key: 'schemaVersion', label }),
    userId: requireString({ obj, key: 'userId', label }),
    preferences: requireStringArray({ obj, key: 'preferences', label }),
    updatedAt: requireString({ obj, key: 'updatedAt', label }),
    ...(defaultGoal !== undefined ? { defaultGoal } : {}),
  };
}

export function validateProjectMemory(raw: unknown): ProjectMemory {
  const label = 'ProjectMemory';
  const obj = asRecord({ raw, label });

  const historyRaw = obj.history;
  if (!Array.isArray(historyRaw)) {
    throw new MemoryStoreError('VALIDATION', `${label}.history must be an array.`);
  }
  const history = historyRaw.map((entry, i) =>
    validateSnapshot({ raw: entry, label: `${label}.history[${i}]` }),
  );

  const latestRaw = obj.latestSnapshot;
  const latestSnapshot =
    latestRaw === undefined || latestRaw === null
      ? undefined
      : validateSnapshot({ raw: latestRaw, label: `${label}.latestSnapshot` });

  return {
    schemaVersion: requireNumber({ obj, key: 'schemaVersion', label }),
    userId: requireString({ obj, key: 'userId', label }),
    projectId: requireString({ obj, key: 'projectId', label }),
    history,
    updatedAt: requireString({ obj, key: 'updatedAt', label }),
    ...(latestSnapshot !== undefined ? { latestSnapshot } : {}),
  };
}
