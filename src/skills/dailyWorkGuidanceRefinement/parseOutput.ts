import { SkillError } from '../../errors/SkillError.js';
import type {
  MemoryUpdate,
  NotionDailyUpdate,
  ProgressStatus,
} from '../dailyWorkGuidance/index.js';
import type { GuidancePlanRefinement, RevisedPlannedStep } from './types.js';

const VALID_PROGRESS_STATUSES: readonly ProgressStatus[] = [
  'done',
  'partial',
  'missing',
  'blocked',
  'unclear',
];

/** The only status the model may put on a revised step — it never approves. */
const PENDING = 'pending_approval';

/**
 * Tolerates JSON wrapped in markdown code fences in case the model adds them
 * despite instructions not to.
 *
 * Throws SkillError('INVALID_OUTPUT') if the output cannot be parsed or fails
 * structural validation — including any revised step whose status is not
 * exactly "pending_approval". Never returns partial data.
 */
export function parseOutput(text: string): GuidancePlanRefinement {
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

function validate(raw: unknown): GuidancePlanRefinement {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new SkillError('INVALID_OUTPUT', 'Model output must be a JSON object.');
  }

  const obj = raw as Record<string, unknown>;

  return {
    revisionSummary: requireString({ obj, key: 'revisionSummary' }),
    revisedSteps: requireRevisedSteps({ obj, key: 'revisedSteps' }),
    notionDailyUpdate: requireNotionDailyUpdate({ obj, key: 'notionDailyUpdate' }),
    memoryUpdate: requireMemoryUpdate({ obj, key: 'memoryUpdate' }),
  };
}

function requireRevisedSteps({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): RevisedPlannedStep[] {
  return requireObjectArray({ obj, key }).map((entry) => {
    const status = entry.status;
    if (status !== PENDING) {
      throw new SkillError(
        'INVALID_OUTPUT',
        `${key}[].status must be exactly "${PENDING}" — the model may not approve steps. Got: ${String(status)}.`,
      );
    }
    const relatedSpecItems = optionalNestedStringArray({ entry, key, field: 'relatedSpecItems' });
    const step: RevisedPlannedStep = {
      respondsTo: requireNestedString({ entry, key, field: 'respondsTo' }),
      title: requireNestedString({ entry, key, field: 'title' }),
      whyItMatters: requireNestedString({ entry, key, field: 'whyItMatters' }),
      expectedOutput: requireNestedString({ entry, key, field: 'expectedOutput' }),
      cursorPrompt: requireNestedString({ entry, key, field: 'cursorPrompt' }),
      validationChecklist: requireNestedStringArray({ entry, key, field: 'validationChecklist' }),
      status: PENDING,
      ...(relatedSpecItems !== undefined ? { relatedSpecItems } : {}),
    };
    return step;
  });
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
  const statuses = requireObjectArray({
    obj: entry,
    key: 'updatedChecklistStatuses',
  }).map((item) => ({
    item: requireNestedString({ entry: item, key: `${key}.updatedChecklistStatuses`, field: 'item' }),
    status: requireNestedProgressStatus({
      entry: item,
      key: `${key}.updatedChecklistStatuses`,
      field: 'status',
    }),
  }));
  return {
    date: requireNestedString({ entry, key, field: 'date' }),
    dailySummary: requireNestedString({ entry, key, field: 'dailySummary' }),
    updatedChecklistStatuses: statuses,
    newDecisions: requireNestedStringArray({ entry, key, field: 'newDecisions' }),
    openBlockers: requireNestedStringArray({ entry, key, field: 'openBlockers' }),
    nextActions: requireNestedStringArray({ entry, key, field: 'nextActions' }),
  };
}

function requireString({ obj, key }: { obj: Record<string, unknown>; key: string }): string {
  const val = obj[key];
  if (typeof val !== 'string' || val.trim() === '') {
    throw new SkillError('INVALID_OUTPUT', `Missing or empty string field: "${key}".`);
  }
  return val;
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

function requireObjectArray({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): Record<string, unknown>[] {
  const val = obj[key];
  if (!Array.isArray(val)) {
    throw new SkillError('INVALID_OUTPUT', `Field "${key}" must be an array.`);
  }
  const result: Record<string, unknown>[] = [];
  for (const item of val) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new SkillError('INVALID_OUTPUT', `All items in "${key}" must be objects.`);
    }
    result.push(item as Record<string, unknown>);
  }
  return result;
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

function optionalNestedStringArray({
  entry,
  key,
  field,
}: {
  entry: Record<string, unknown>;
  key: string;
  field: string;
}): string[] | undefined {
  if (entry[field] === undefined || entry[field] === null) {
    return undefined;
  }
  return requireNestedStringArray({ entry, key, field });
}

function requireNestedProgressStatus({
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
