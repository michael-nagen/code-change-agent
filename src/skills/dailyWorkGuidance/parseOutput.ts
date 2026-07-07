import { SkillError } from '../../errors/SkillError.js';
import type {
  AdvancedChecklistItem,
  ApprovalStatus,
  BlockerOrRisk,
  ChecklistStatusEntry,
  Confidence,
  DailyWorkGuidance,
  DecisionNeedingApproval,
  MemoryUpdate,
  NotionDailyUpdate,
  PlannedStep,
  ProgressItem,
  ProgressStatus,
} from './types.js';

const VALID_PROGRESS_STATUSES: readonly ProgressStatus[] = [
  'done',
  'partial',
  'missing',
  'blocked',
  'unclear',
];

const VALID_CONFIDENCES: readonly Confidence[] = ['high', 'medium', 'low'];

const APPROVAL_STATUS: ApprovalStatus = 'pending_approval';

/**
 * Tolerates JSON wrapped in markdown code fences in case the model adds them
 * despite instructions not to.
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
    yesterdaySummary: requireString({ obj, key: 'yesterdaySummary' }),
    progressVsSpec: requireProgressItems({ obj, key: 'progressVsSpec' }),
    advancedChecklistItems: requireAdvancedItems({ obj, key: 'advancedChecklistItems' }),
    blockersAndRisks: requireBlockers({ obj, key: 'blockersAndRisks' }),
    decisionsNeedingApproval: requireDecisions({ obj, key: 'decisionsNeedingApproval' }),
    plannedSteps: requirePlannedSteps({ obj, key: 'plannedSteps' }),
    notionDailyUpdate: requireNotionDailyUpdate({ obj, key: 'notionDailyUpdate' }),
    memoryUpdate: requireMemoryUpdate({ obj, key: 'memoryUpdate' }),
  };
}

function requireProgressItems({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): ProgressItem[] {
  return requireObjectArray({ obj, key }).map((entry) => {
    const previousStatus = optionalNestedStatus({ entry, key, field: 'previousStatus' });
    const item: ProgressItem = {
      item: requireNestedString({ entry, key, field: 'item' }),
      whatChanged: requireNestedString({ entry, key, field: 'whatChanged' }),
      newStatus: requireNestedStatus({ entry, key, field: 'newStatus' }),
      evidence: requireNestedString({ entry, key, field: 'evidence' }),
      confidence: requireNestedConfidence({ entry, key, field: 'confidence' }),
      ...(previousStatus !== undefined ? { previousStatus } : {}),
    };
    return item;
  });
}

function requireAdvancedItems({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): AdvancedChecklistItem[] {
  return requireObjectArray({ obj, key }).map((entry) => ({
    item: requireNestedString({ entry, key, field: 'item' }),
    previousStatus: requireNestedStatus({ entry, key, field: 'previousStatus' }),
    newStatus: requireNestedStatus({ entry, key, field: 'newStatus' }),
    whatAdvanced: requireNestedString({ entry, key, field: 'whatAdvanced' }),
    evidence: requireNestedString({ entry, key, field: 'evidence' }),
  }));
}

function requireBlockers({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): BlockerOrRisk[] {
  return requireObjectArray({ obj, key }).map((entry) => {
    const severity = optionalNestedString({ entry, key, field: 'severity' });
    const blocker: BlockerOrRisk = {
      title: requireNestedString({ entry, key, field: 'title' }),
      description: requireNestedString({ entry, key, field: 'description' }),
      whyItMatters: requireNestedString({ entry, key, field: 'whyItMatters' }),
      requiredAction: requireNestedString({ entry, key, field: 'requiredAction' }),
      ...(severity !== undefined ? { severity } : {}),
    };
    return blocker;
  });
}

function requireDecisions({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): DecisionNeedingApproval[] {
  return requireObjectArray({ obj, key }).map((entry) => {
    const options = optionalNestedStringArray({ entry, key, field: 'options' });
    const recommendedOption = optionalNestedString({ entry, key, field: 'recommendedOption' });
    const decision: DecisionNeedingApproval = {
      decision: requireNestedString({ entry, key, field: 'decision' }),
      context: requireNestedString({ entry, key, field: 'context' }),
      status: requireApprovalStatus({ entry, key, field: 'status' }),
      ...(options !== undefined ? { options } : {}),
      ...(recommendedOption !== undefined ? { recommendedOption } : {}),
    };
    return decision;
  });
}

function requirePlannedSteps({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): PlannedStep[] {
  return requireObjectArray({ obj, key }).map((entry) => {
    const relatedSpecItems = optionalNestedStringArray({ entry, key, field: 'relatedSpecItems' });
    const step: PlannedStep = {
      id: requireNestedString({ entry, key, field: 'id' }),
      title: requireNestedString({ entry, key, field: 'title' }),
      whyItMatters: requireNestedString({ entry, key, field: 'whyItMatters' }),
      expectedOutput: requireNestedString({ entry, key, field: 'expectedOutput' }),
      cursorPrompt: requireNestedString({ entry, key, field: 'cursorPrompt' }),
      validationChecklist: requireNestedStringArray({ entry, key, field: 'validationChecklist' }),
      status: requireApprovalStatus({ entry, key, field: 'status' }),
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
  return {
    date: requireNestedString({ entry, key, field: 'date' }),
    dailySummary: requireNestedString({ entry, key, field: 'dailySummary' }),
    updatedChecklistStatuses: requireChecklistStatuses({ entry, key, field: 'updatedChecklistStatuses' }),
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
  if (val === undefined || val === null) {
    return undefined;
  }
  if (typeof val !== 'string' || val.trim() === '') {
    throw new SkillError('INVALID_OUTPUT', `${key}.${field} must be a non-empty string when present.`);
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
  const val = entry[field];
  if (val === undefined || val === null) {
    return undefined;
  }
  return requireNestedStringArray({ entry, key, field });
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

function optionalNestedStatus({
  entry,
  key,
  field,
}: {
  entry: Record<string, unknown>;
  key: string;
  field: string;
}): ProgressStatus | undefined {
  const val = entry[field];
  if (val === undefined || val === null || val === '') {
    return undefined;
  }
  return requireNestedStatus({ entry, key, field });
}

function requireNestedConfidence({
  entry,
  key,
  field,
}: {
  entry: Record<string, unknown>;
  key: string;
  field: string;
}): Confidence {
  const val = entry[field];
  if (typeof val !== 'string' || !(VALID_CONFIDENCES as readonly string[]).includes(val)) {
    throw new SkillError(
      'INVALID_OUTPUT',
      `${key}.${field} must be one of: ${VALID_CONFIDENCES.join(', ')}. Got: ${String(val)}.`,
    );
  }
  return val as Confidence;
}

function requireApprovalStatus({
  entry,
  key,
  field,
}: {
  entry: Record<string, unknown>;
  key: string;
  field: string;
}): ApprovalStatus {
  const val = entry[field];
  if (val !== APPROVAL_STATUS) {
    throw new SkillError(
      'INVALID_OUTPUT',
      `${key}.${field} must be "${APPROVAL_STATUS}". Got: ${String(val)}.`,
    );
  }
  return APPROVAL_STATUS;
}
