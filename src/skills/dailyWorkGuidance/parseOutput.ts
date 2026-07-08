import { SkillError } from '../../errors/SkillError.js';
import type {
  ChecklistStatusEntry,
  DailyWorkGuidance,
  MemoryUpdate,
  NotionDailyUpdate,
  ProgressStatus,
} from './types.js';

const VALID_PROGRESS_STATUSES: readonly ProgressStatus[] = [
  'done',
  'partial',
  'missing',
  'blocked',
  'unclear',
];

/**
 * Parses the lean Daily Work Guidance checkpoint. Tolerates JSON wrapped in
 * markdown code fences in case the model adds them despite instructions not to.
 *
 * Throws SkillError('INVALID_OUTPUT') if the output cannot be parsed or fails
 * structural validation. Never returns partial data.
 */
export function parseOutput(text: string): DailyWorkGuidance {
  const json = extractJson(text);

  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new SkillError(
      'INVALID_OUTPUT',
      `Model output is not valid JSON. First 200 chars: ${json.slice(0, 200)}`,
    );
  }

  return validate(raw);
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch !== null) {
    const inner = fenceMatch[1];
    if (inner !== undefined) {
      return inner;
    }
  }
  return trimmed;
}

function validate(raw: unknown): DailyWorkGuidance {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new SkillError('INVALID_OUTPUT', 'Model output must be a JSON object.');
  }

  const obj = raw as Record<string, unknown>;

  return {
    headline: requireString({ obj, key: 'headline' }),
    whatChanged: requireStringArray({ obj, key: 'whatChanged' }),
    nextActions: requireStringArray({ obj, key: 'nextActions' }),
    // Blockers/decisions are optional content: an empty array is valid and means
    // "nothing important to flag". Missing is tolerated as empty.
    blockersOrDecisions: optionalStringArray({ obj, key: 'blockersOrDecisions' }) ?? [],
    notionDailyUpdate: requireNotionDailyUpdate({ obj, key: 'notionDailyUpdate' }),
    memoryUpdate: requireMemoryUpdate({ obj, key: 'memoryUpdate' }),
  };
}

function requireNotionDailyUpdate({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): NotionDailyUpdate {
  const entry = requireObject({ obj, key });
  return {
    yesterday: requireNestedString({ entry, key, field: 'yesterday' }),
    today: requireNestedString({ entry, key, field: 'today' }),
    blockers: requireNestedString({ entry, key, field: 'blockers' }),
    decisionsNeeded: requireNestedString({ entry, key, field: 'decisionsNeeded' }),
    progressVsSpec: requireNestedString({ entry, key, field: 'progressVsSpec' }),
    nextCursorPrompt: requireNestedString({ entry, key, field: 'nextCursorPrompt' }),
  };
}

function requireMemoryUpdate({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): MemoryUpdate {
  const entry = requireObject({ obj, key });
  return {
    date: requireNestedString({ entry, key, field: 'date' }),
    dailySummary: requireNestedString({ entry, key, field: 'dailySummary' }),
    updatedChecklistStatuses: requireChecklistStatuses({
      entry,
      key,
      field: 'updatedChecklistStatuses',
    }),
    newDecisions: requireNestedStringArray({ entry, key, field: 'newDecisions' }),
    openBlockers: requireNestedStringArray({ entry, key, field: 'openBlockers' }),
    nextActions: requireNestedStringArray({ entry, key, field: 'nextActions' }),
  };
}

function requireChecklistStatuses({
  entry,
  key,
  field,
}: {
  entry: Record<string, unknown>;
  key: string;
  field: string;
}): ChecklistStatusEntry[] {
  const val = entry[field];
  if (!Array.isArray(val)) {
    throw new SkillError('INVALID_OUTPUT', `${key}.${field} must be an array.`);
  }
  return val.map((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new SkillError('INVALID_OUTPUT', `All items in ${key}.${field} must be objects.`);
    }
    const nested = item as Record<string, unknown>;
    return {
      item: requireNestedString({ entry: nested, key: `${key}.${field}`, field: 'item' }),
      status: requireNestedStatus({ entry: nested, key: `${key}.${field}`, field: 'status' }),
    };
  });
}

function requireString({ obj, key }: { obj: Record<string, unknown>; key: string }): string {
  const val = obj[key];
  if (typeof val !== 'string' || val.trim() === '') {
    throw new SkillError('INVALID_OUTPUT', `Missing or empty string field: "${key}".`);
  }
  return val;
}

function requireStringArray({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): string[] {
  const val = optionalStringArray({ obj, key });
  if (val === undefined) {
    throw new SkillError('INVALID_OUTPUT', `Field "${key}" must be an array.`);
  }
  return val;
}

function optionalStringArray({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): string[] | undefined {
  const val = obj[key];
  if (val === undefined || val === null) {
    return undefined;
  }
  if (!Array.isArray(val)) {
    throw new SkillError('INVALID_OUTPUT', `Field "${key}" must be an array.`);
  }
  const result: string[] = [];
  for (const item of val) {
    if (typeof item !== 'string' || item.trim() === '') {
      throw new SkillError('INVALID_OUTPUT', `All items in "${key}" must be non-empty strings.`);
    }
    result.push(item);
  }
  return result;
}

function requireObject({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): Record<string, unknown> {
  const val = obj[key];
  if (typeof val !== 'object' || val === null || Array.isArray(val)) {
    throw new SkillError('INVALID_OUTPUT', `Field "${key}" must be an object.`);
  }
  return val as Record<string, unknown>;
}

function requireNestedString({
  entry,
  key,
  field,
}: {
  entry: Record<string, unknown>;
  key: string;
  field: string;
}): string {
  const val = entry[field];
  if (typeof val !== 'string' || val.trim() === '') {
    throw new SkillError('INVALID_OUTPUT', `${key}.${field} must be a non-empty string.`);
  }
  return val;
}

function requireNestedStringArray({
  entry,
  key,
  field,
}: {
  entry: Record<string, unknown>;
  key: string;
  field: string;
}): string[] {
  const val = entry[field];
  if (!Array.isArray(val)) {
    throw new SkillError('INVALID_OUTPUT', `${key}.${field} must be an array.`);
  }
  const result: string[] = [];
  for (const item of val) {
    if (typeof item !== 'string') {
      throw new SkillError('INVALID_OUTPUT', `All items in ${key}.${field} must be strings.`);
    }
    result.push(item);
  }
  return result;
}

function requireNestedStatus({
  entry,
  key,
  field,
}: {
  entry: Record<string, unknown>;
  key: string;
  field: string;
}): ProgressStatus {
  const val = entry[field];
  if (typeof val !== 'string' || !(VALID_PROGRESS_STATUSES as readonly string[]).includes(val)) {
    throw new SkillError(
      'INVALID_OUTPUT',
      `${key}.${field} must be one of: ${VALID_PROGRESS_STATUSES.join(', ')}. Got: ${String(val)}.`,
    );
  }
  return val as ProgressStatus;
}
