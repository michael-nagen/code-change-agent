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
  GeneralResponsePreferences,
  PlanDecisionRecord,
  ProjectMemory,
  ProjectProgressSnapshot,
  PromptPreferences,
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

function optionalBoolean({
  obj,
  key,
  label,
}: {
  obj: Record<string, unknown>;
  key: string;
  label: string;
}): boolean | undefined {
  const val = obj[key];
  if (val === undefined || val === null) return undefined;
  if (typeof val !== 'boolean') {
    throw new MemoryStoreError('VALIDATION', `${label}.${key} must be a boolean when present.`);
  }
  return val;
}

function optionalStringArray({
  obj,
  key,
  label,
}: {
  obj: Record<string, unknown>;
  key: string;
  label: string;
}): string[] | undefined {
  const val = obj[key];
  if (val === undefined || val === null) return undefined;
  return requireStringArray({ obj, key, label });
}

function validateGeneralPreferences({
  raw,
  label,
}: {
  raw: unknown;
  label: string;
}): GeneralResponsePreferences {
  const obj = asRecord({ raw, label });
  const out: GeneralResponsePreferences = {};
  const s = (key: keyof GeneralResponsePreferences) => optionalString({ obj, key, label });
  const b = (key: keyof GeneralResponsePreferences) => optionalBoolean({ obj, key, label });
  const preferredLanguage = s('preferredLanguage');
  const preferredTone = s('preferredTone');
  const preferredOutputLength = s('preferredOutputLength');
  const preferredStructure = s('preferredStructure');
  const includeConciseSummaries = b('includeConciseSummaries');
  const includeDetailedImplementationPrompts = b('includeDetailedImplementationPrompts');
  if (preferredLanguage !== undefined) out.preferredLanguage = preferredLanguage;
  if (preferredTone !== undefined) out.preferredTone = preferredTone;
  if (preferredOutputLength !== undefined) out.preferredOutputLength = preferredOutputLength;
  if (preferredStructure !== undefined) out.preferredStructure = preferredStructure;
  if (includeConciseSummaries !== undefined) out.includeConciseSummaries = includeConciseSummaries;
  if (includeDetailedImplementationPrompts !== undefined) {
    out.includeDetailedImplementationPrompts = includeDetailedImplementationPrompts;
  }
  return out;
}

/**
 * Validate the structured personal working / prompt preferences. Every field is
 * optional, but any present field must have the right shape — malformed
 * preferences (e.g. a non-string bullet) are rejected so invalid data is never
 * saved.
 */
export function validatePromptPreferences(raw: unknown): PromptPreferences {
  const label = 'PromptPreferences';
  const obj = asRecord({ raw, label });
  const out: PromptPreferences = {};

  if (obj.general !== undefined && obj.general !== null) {
    out.general = validateGeneralPreferences({ raw: obj.general, label: `${label}.general` });
  }

  const listKeys: (keyof PromptPreferences)[] = [
    'cursor',
    'claudeCode',
    'codeReview',
    'dailyUpdate',
    'weeklyReview',
    'demoVideo',
    'mentorUpdate',
  ];
  for (const key of listKeys) {
    const arr = optionalStringArray({ obj, key: key as string, label });
    if (arr !== undefined) {
      (out as Record<string, unknown>)[key] = arr;
    }
  }

  return out;
}

function optionalPromptPreferences({
  obj,
  key,
  label,
}: {
  obj: Record<string, unknown>;
  key: string;
  label: string;
}): PromptPreferences | undefined {
  const val = obj[key];
  if (val === undefined || val === null) return undefined;
  try {
    return validatePromptPreferences(val);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new MemoryStoreError('VALIDATION', `${label}.${key} is invalid: ${detail}`);
  }
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

function validatePlanDecisions({
  obj,
  key,
  label,
}: {
  obj: Record<string, unknown>;
  key: string;
  label: string;
}): PlanDecisionRecord[] | undefined {
  const val = obj[key];
  if (val === undefined || val === null) return undefined;
  if (!Array.isArray(val)) {
    throw new MemoryStoreError('VALIDATION', `${label}.${key} must be an array when present.`);
  }
  return val.map((item, i) => {
    const entryLabel = `${label}.${key}[${i}]`;
    const entry = asRecord({ raw: item, label: entryLabel });
    const note = optionalString({ obj: entry, key: 'note', label: entryLabel });
    return {
      itemId: requireString({ obj: entry, key: 'itemId', label: entryLabel }),
      action: requireString({ obj: entry, key: 'action', label: entryLabel }),
      text: requireString({ obj: entry, key: 'text', label: entryLabel }),
      ...(note !== undefined ? { note } : {}),
    };
  });
}

function validateSnapshot({ raw, label }: { raw: unknown; label: string }): ProjectProgressSnapshot {
  const obj = asRecord({ raw, label });
  const loopStage = optionalString({ obj, key: 'loopStage', label });
  const planDecisions = validatePlanDecisions({ obj, key: 'planDecisions', label });
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
    ...(loopStage !== undefined ? { loopStage } : {}),
    ...(planDecisions !== undefined ? { planDecisions } : {}),
  };
}

export function validateUserPreferencesMemory(raw: unknown): UserPreferencesMemory {
  const label = 'UserPreferencesMemory';
  const obj = asRecord({ raw, label });
  const defaultGoal = optionalString({ obj, key: 'defaultGoal', label });
  const promptPreferences = optionalPromptPreferences({ obj, key: 'promptPreferences', label });
  return {
    schemaVersion: requireNumber({ obj, key: 'schemaVersion', label }),
    userId: requireString({ obj, key: 'userId', label }),
    preferences: requireStringArray({ obj, key: 'preferences', label }),
    updatedAt: requireString({ obj, key: 'updatedAt', label }),
    ...(defaultGoal !== undefined ? { defaultGoal } : {}),
    ...(promptPreferences !== undefined ? { promptPreferences } : {}),
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

  const activeSpecSummary = optionalString({ obj, key: 'activeSpecSummary', label });

  return {
    schemaVersion: requireNumber({ obj, key: 'schemaVersion', label }),
    userId: requireString({ obj, key: 'userId', label }),
    projectId: requireString({ obj, key: 'projectId', label }),
    history,
    updatedAt: requireString({ obj, key: 'updatedAt', label }),
    ...(activeSpecSummary !== undefined ? { activeSpecSummary } : {}),
    ...(latestSnapshot !== undefined ? { latestSnapshot } : {}),
  };
}
