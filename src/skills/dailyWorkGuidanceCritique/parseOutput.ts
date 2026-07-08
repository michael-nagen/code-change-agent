import { SkillError } from '../../errors/SkillError.js';
import type {
  Confidence,
  GuidanceCritiqueIssue,
  MemoryUpdate,
  NotionDailyUpdate,
  ProgressStatus,
} from '../dailyWorkGuidance/index.js';
import type {
  CritiqueRevisedDecision,
  CritiqueRevisedPlan,
  CritiqueRevisedStep,
  GuidancePlanCritique,
} from './types.js';

const VALID_SEVERITIES = ['high', 'medium', 'low'] as const;
const VALID_CONFIDENCES: readonly Confidence[] = ['high', 'medium', 'low'];
const VALID_PROGRESS_STATUSES: readonly ProgressStatus[] = [
  'done',
  'partial',
  'missing',
  'blocked',
  'unclear',
];

/** The only status the critic may put on revised items — it never approves. */
const PENDING = 'pending_approval';

/**
 * Tolerates JSON wrapped in markdown code fences in case the model adds them
 * despite instructions not to.
 *
 * Throws SkillError('INVALID_OUTPUT') if the output cannot be parsed or fails
 * structural validation — including a revised item whose status is not
 * exactly "pending_approval", or a revisedPlan that is present/absent
 * inconsistently with revisionNeeded. Never returns partial data.
 */
export function parseOutput(text: string): GuidancePlanCritique {
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

function validate(raw: unknown): GuidancePlanCritique {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new SkillError('INVALID_OUTPUT', 'Model output must be a JSON object.');
  }

  const obj = raw as Record<string, unknown>;
  const revisionNeeded = requireBoolean({ obj, key: 'revisionNeeded' });
  const revisedPlanRaw = obj.revisedPlan;

  if (revisionNeeded && (revisedPlanRaw === undefined || revisedPlanRaw === null)) {
    throw new SkillError(
      'INVALID_OUTPUT',
      'revisionNeeded is true but no revisedPlan was provided.',
    );
  }
  if (!revisionNeeded && revisedPlanRaw !== undefined && revisedPlanRaw !== null) {
    throw new SkillError(
      'INVALID_OUTPUT',
      'revisionNeeded is false but a revisedPlan was provided — the pair is inconsistent.',
    );
  }

  return {
    issues: requireIssues({ obj, key: 'issues' }),
    revisionNeeded,
    summary: requireString({ obj, key: 'summary' }),
    confidence: requireEnum({ obj, key: 'confidence', valid: VALID_CONFIDENCES }),
    ...(revisionNeeded ? { revisedPlan: requireRevisedPlan({ obj, key: 'revisedPlan' }) } : {}),
  };
}

function requireIssues({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): GuidanceCritiqueIssue[] {
  return requireObjectArray({ obj, key }).map((entry) => {
    const targetStepId = optionalNestedString({ entry, key, field: 'targetStepId' });
    const issue: GuidanceCritiqueIssue = {
      issue: requireNestedString({ entry, key, field: 'issue' }),
      severity: requireNestedEnum({ entry, key, field: 'severity', valid: VALID_SEVERITIES }),
      suggestion: requireNestedString({ entry, key, field: 'suggestion' }),
      ...(targetStepId !== undefined ? { targetStepId } : {}),
    };
    return issue;
  });
}

function requireRevisedPlan({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): CritiqueRevisedPlan {
  const entry = requireObject({ obj, key });
  const steps = requireRevisedSteps({ obj: entry, key: `${key}.plannedSteps` });
  if (steps.length === 0) {
    throw new SkillError('INVALID_OUTPUT', `${key}.plannedSteps must not be empty.`);
  }
  const decisions =
    entry.decisionsNeedingApproval === undefined || entry.decisionsNeedingApproval === null
      ? undefined
      : requireRevisedDecisions({ obj: entry, key: `${key}.decisionsNeedingApproval` });
  return {
    plannedSteps: steps,
    notionDailyUpdate: requireNotionDailyUpdate({ entry, key }),
    memoryUpdate: requireMemoryUpdate({ entry, key }),
    ...(decisions !== undefined ? { decisionsNeedingApproval: decisions } : {}),
  };
}

function requireRevisedSteps({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): CritiqueRevisedStep[] {
  const val = obj.plannedSteps;
  if (!Array.isArray(val)) {
    throw new SkillError('INVALID_OUTPUT', `${key} must be an array.`);
  }
  return val.map((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new SkillError('INVALID_OUTPUT', `All items in ${key} must be objects.`);
    }
    const entry = item as Record<string, unknown>;
    assertPending({ entry, key });
    const relatedSpecItems = optionalNestedStringArray({ entry, key, field: 'relatedSpecItems' });
    const step: CritiqueRevisedStep = {
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

function requireRevisedDecisions({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): CritiqueRevisedDecision[] {
  const val = obj['decisionsNeedingApproval'];
  if (!Array.isArray(val)) {
    throw new SkillError('INVALID_OUTPUT', `${key} must be an array when present.`);
  }
  return val.map((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new SkillError('INVALID_OUTPUT', `All items in ${key} must be objects.`);
    }
    const entry = item as Record<string, unknown>;
    assertPending({ entry, key });
    const options = optionalNestedStringArray({ entry, key, field: 'options' });
    const recommendedOption = optionalNestedString({ entry, key, field: 'recommendedOption' });
    const decision: CritiqueRevisedDecision = {
      decision: requireNestedString({ entry, key, field: 'decision' }),
      context: requireNestedString({ entry, key, field: 'context' }),
      status: PENDING,
      ...(options !== undefined ? { options } : {}),
      ...(recommendedOption !== undefined ? { recommendedOption } : {}),
    };
    return decision;
  });
}

/** The critic has no approval authority — anything not pending fails closed. */
function assertPending({ entry, key }: { entry: Record<string, unknown>; key: string }): void {
  if (entry.status !== PENDING) {
    throw new SkillError(
      'INVALID_OUTPUT',
      `${key}[].status must be exactly "${PENDING}" — the critic may not approve. Got: ${String(entry.status)}.`,
    );
  }
}

function requireNotionDailyUpdate({
  entry,
  key,
}: {
  entry: Record<string, unknown>;
  key: string;
}): NotionDailyUpdate {
  const nested = requireObject({ obj: entry, key: 'notionDailyUpdate' });
  const label = `${key}.notionDailyUpdate`;
  return {
    yesterday: requireNestedString({ entry: nested, key: label, field: 'yesterday' }),
    today: requireNestedString({ entry: nested, key: label, field: 'today' }),
    blockers: requireNestedString({ entry: nested, key: label, field: 'blockers' }),
    decisionsNeeded: requireNestedString({ entry: nested, key: label, field: 'decisionsNeeded' }),
    progressVsSpec: requireNestedString({ entry: nested, key: label, field: 'progressVsSpec' }),
    nextCursorPrompt: requireNestedString({ entry: nested, key: label, field: 'nextCursorPrompt' }),
  };
}

function requireMemoryUpdate({
  entry,
  key,
}: {
  entry: Record<string, unknown>;
  key: string;
}): MemoryUpdate {
  const nested = requireObject({ obj: entry, key: 'memoryUpdate' });
  const label = `${key}.memoryUpdate`;
  const statuses = requireObjectArray({ obj: nested, key: 'updatedChecklistStatuses' }).map(
    (item) => ({
      item: requireNestedString({ entry: item, key: `${label}.updatedChecklistStatuses`, field: 'item' }),
      status: requireNestedEnum({
        entry: item,
        key: `${label}.updatedChecklistStatuses`,
        field: 'status',
        valid: VALID_PROGRESS_STATUSES,
      }),
    }),
  );
  return {
    date: requireNestedString({ entry: nested, key: label, field: 'date' }),
    dailySummary: requireNestedString({ entry: nested, key: label, field: 'dailySummary' }),
    updatedChecklistStatuses: statuses,
    newDecisions: requireNestedStringArray({ entry: nested, key: label, field: 'newDecisions' }),
    openBlockers: requireNestedStringArray({ entry: nested, key: label, field: 'openBlockers' }),
    nextActions: requireNestedStringArray({ entry: nested, key: label, field: 'nextActions' }),
  };
}

function requireString({ obj, key }: { obj: Record<string, unknown>; key: string }): string {
  const val = obj[key];
  if (typeof val !== 'string' || val.trim() === '') {
    throw new SkillError('INVALID_OUTPUT', `Missing or empty string field: "${key}".`);
  }
  return val;
}

function requireBoolean({ obj, key }: { obj: Record<string, unknown>; key: string }): boolean {
  const val = obj[key];
  if (typeof val !== 'boolean') {
    throw new SkillError('INVALID_OUTPUT', `Field "${key}" must be a boolean.`);
  }
  return val;
}

function requireEnum<T extends string>({
  obj,
  key,
  valid,
}: {
  obj: Record<string, unknown>;
  key: string;
  valid: readonly T[];
}): T {
  const val = obj[key];
  if (typeof val !== 'string' || !(valid as readonly string[]).includes(val)) {
    throw new SkillError(
      'INVALID_OUTPUT',
      `Field "${key}" must be one of: ${valid.join(', ')}. Got: ${String(val)}.`,
    );
  }
  return val as T;
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

function optionalNestedString({
  entry,
  key,
  field,
}: {
  entry: Record<string, unknown>;
  key: string;
  field: string;
}): string | undefined {
  const val = entry[field];
  if (val === undefined || val === null || val === '') {
    return undefined;
  }
  if (typeof val !== 'string' || val.trim() === '') {
    throw new SkillError(
      'INVALID_OUTPUT',
      `${key}.${field} must be a non-empty string when present.`,
    );
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

function requireNestedEnum<T extends string>({
  entry,
  key,
  field,
  valid,
}: {
  entry: Record<string, unknown>;
  key: string;
  field: string;
  valid: readonly T[];
}): T {
  const val = entry[field];
  if (typeof val !== 'string' || !(valid as readonly string[]).includes(val)) {
    throw new SkillError(
      'INVALID_OUTPUT',
      `${key}.${field} must be one of: ${valid.join(', ')}. Got: ${String(val)}.`,
    );
  }
  return val as T;
}
