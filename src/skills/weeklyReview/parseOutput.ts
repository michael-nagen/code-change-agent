import { SkillError } from '../../errors/SkillError.js';
import type {
  Confidence,
  DecisionStatus,
  DemoSegment,
  DemoVideoStory,
  EvidenceLevel,
  KeyDecision,
  ReviewSource,
  SpecItemStatus,
  SpecProgressItem,
  SuggestedWeeklyUpdate,
  TechnicalChangeItem,
  WeeklyBlockerOrRisk,
  WeeklyChecklistStatus,
  WeeklyMemoryUpdateProposal,
  WeeklyReview,
  WeeklyReviewStatus,
  WhatChangedTechnically,
  RiskStatus,
} from './types.js';

const VALID_CONFIDENCE: readonly Confidence[] = ['high', 'medium', 'low'];
const VALID_EVIDENCE: readonly EvidenceLevel[] = ['confirmed', 'inferred'];
const VALID_SOURCE: readonly ReviewSource[] = [
  'memory',
  'daily',
  'technical_brief',
  'demo_prep',
  'current_run',
  'inferred',
];
const VALID_SPEC_STATUS: readonly SpecItemStatus[] = [
  'done',
  'partial',
  'blocked',
  'unclear',
  'not_started',
];
const VALID_DECISION_STATUS: readonly DecisionStatus[] = ['active', 'open', 'superseded'];
const VALID_RISK_STATUS: readonly RiskStatus[] = ['open', 'resolved', 'needs_review'];

/**
 * Tolerates JSON wrapped in markdown code fences. Throws
 * SkillError('INVALID_OUTPUT') if the output cannot be parsed or fails
 * structural validation. Never returns partial data.
 */
export function parseOutput(text: string): WeeklyReview {
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

function validate(raw: unknown): WeeklyReview {
  const obj = requireObjectValue({ value: raw, label: 'WeeklyReview' });
  return {
    status: validateStatus(requireObject({ obj, key: 'status' })),
    executiveSummary: requireString({ obj, key: 'executiveSummary' }),
    progressAgainstSpec: requireObjectArray({ obj, key: 'progressAgainstSpec' }).map(
      validateSpecItem,
    ),
    whatChangedTechnically: validateWhatChangedTechnically(
      requireObject({ obj, key: 'whatChangedTechnically' }),
    ),
    keyDecisions: requireObjectArray({ obj, key: 'keyDecisions' }).map(validateDecision),
    blockersAndRisks: requireObjectArray({ obj, key: 'blockersAndRisks' }).map(validateRisk),
    demoVideoStory: validateDemoVideoStory(requireObject({ obj, key: 'demoVideoStory' })),
    reviewTalkingPoints: requireStringArray({ obj, key: 'reviewTalkingPoints' }),
    suggestedWeeklyUpdate: validateWeeklyUpdate(
      requireObject({ obj, key: 'suggestedWeeklyUpdate' }),
    ),
    nextWeekPlan: requireStringArray({ obj, key: 'nextWeekPlan' }),
    memoryUpdateProposal: validateMemoryProposal(
      requireObject({ obj, key: 'memoryUpdateProposal' }),
    ),
  };
}

function validateStatus(obj: Record<string, unknown>): WeeklyReviewStatus {
  const status = obj.status;
  if (status !== 'draft') {
    throw new SkillError('INVALID_OUTPUT', `status.status must be "draft". Got: ${String(status)}.`);
  }
  return {
    status: 'draft',
    confidence: requireEnum({ value: obj.confidence, allowed: VALID_CONFIDENCE, ctx: 'status.confidence' }),
    missingInputs: requireStringArray({ obj, key: 'missingInputs' }),
    reviewPeriodLabel: requireString({ obj, key: 'reviewPeriodLabel' }),
    generatedAt: requireString({ obj, key: 'generatedAt' }),
  };
}

function validateSpecItem(entry: Record<string, unknown>): SpecProgressItem {
  const label = 'progressAgainstSpec';
  return {
    title: requireNestedString({ entry, label, field: 'title' }),
    status: requireEnum({ value: entry.status, allowed: VALID_SPEC_STATUS, ctx: `${label}.status` }),
    evidence: requireNestedString({ entry, label, field: 'evidence' }),
    notes: requireNestedString({ entry, label, field: 'notes' }),
    source: requireEnum({ value: entry.source, allowed: VALID_SOURCE, ctx: `${label}.source` }),
  };
}

function validateTechnicalChangeItems({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): TechnicalChangeItem[] {
  return requireObjectArray({ obj, key }).map((entry) => {
    const filePath = optionalNestedString({ entry, label: key, field: 'filePath' });
    const item: TechnicalChangeItem = {
      description: requireNestedString({ entry, label: key, field: 'description' }),
      evidence: requireEnum({ value: entry.evidence, allowed: VALID_EVIDENCE, ctx: `${key}.evidence` }),
      ...(filePath !== undefined ? { filePath } : {}),
    };
    return item;
  });
}

function validateWhatChangedTechnically(obj: Record<string, unknown>): WhatChangedTechnically {
  return {
    schemaOrDataChanges: validateTechnicalChangeItems({ obj, key: 'schemaOrDataChanges' }),
    modelOrTypeChanges: validateTechnicalChangeItems({ obj, key: 'modelOrTypeChanges' }),
    workflowOrRuntimeChanges: validateTechnicalChangeItems({ obj, key: 'workflowOrRuntimeChanges' }),
    uiChanges: validateTechnicalChangeItems({ obj, key: 'uiChanges' }),
    toolsOrSkillsAdded: validateTechnicalChangeItems({ obj, key: 'toolsOrSkillsAdded' }),
    importantFilesOrModules: requireStringArray({ obj, key: 'importantFilesOrModules' }),
  };
}

function validateDecision(entry: Record<string, unknown>): KeyDecision {
  const label = 'keyDecisions';
  return {
    decision: requireNestedString({ entry, label, field: 'decision' }),
    why: requireNestedString({ entry, label, field: 'why' }),
    impact: requireNestedString({ entry, label, field: 'impact' }),
    status: requireEnum({ value: entry.status, allowed: VALID_DECISION_STATUS, ctx: `${label}.status` }),
    source: requireEnum({ value: entry.source, allowed: VALID_SOURCE, ctx: `${label}.source` }),
  };
}

function validateRisk(entry: Record<string, unknown>): WeeklyBlockerOrRisk {
  const label = 'blockersAndRisks';
  return {
    title: requireNestedString({ entry, label, field: 'title' }),
    whyItMatters: requireNestedString({ entry, label, field: 'whyItMatters' }),
    status: requireEnum({ value: entry.status, allowed: VALID_RISK_STATUS, ctx: `${label}.status` }),
    suggestedNextAction: requireNestedString({ entry, label, field: 'suggestedNextAction' }),
  };
}

function validateDemoSegment(entry: Record<string, unknown>): DemoSegment {
  const label = 'demoVideoStory.recommendedStructure';
  return {
    title: requireNestedString({ entry, label, field: 'title' }),
    durationLabel: requireNestedString({ entry, label, field: 'durationLabel' }),
    focus: requireNestedString({ entry, label, field: 'focus' }),
  };
}

function validateDemoVideoStory(obj: Record<string, unknown>): DemoVideoStory {
  return {
    strongestStory: requireString({ obj, key: 'strongestStory' }),
    whatToShow: requireStringArray({ obj, key: 'whatToShow' }),
    whatToSay: requireStringArray({ obj, key: 'whatToSay' }),
    whatToSkip: requireStringArray({ obj, key: 'whatToSkip' }),
    recommendedStructure: requireObjectArray({ obj, key: 'recommendedStructure' }).map(
      validateDemoSegment,
    ),
    keyFilesOrScreens: requireStringArray({ obj, key: 'keyFilesOrScreens' }),
    strongestProductSentence: requireString({ obj, key: 'strongestProductSentence' }),
  };
}

function validateWeeklyUpdate(obj: Record<string, unknown>): SuggestedWeeklyUpdate {
  return {
    thisWeek: requireString({ obj, key: 'thisWeek' }),
    technicalProgress: requireString({ obj, key: 'technicalProgress' }),
    demoProductProgress: requireString({ obj, key: 'demoProductProgress' }),
    blockers: requireString({ obj, key: 'blockers' }),
    nextWeek: requireString({ obj, key: 'nextWeek' }),
  };
}

function validateChecklistStatuses({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): WeeklyChecklistStatus[] {
  return requireObjectArray({ obj, key }).map((entry) => ({
    item: requireNestedString({ entry, label: key, field: 'item' }),
    status: requireNestedString({ entry, label: key, field: 'status' }),
  }));
}

function validateMemoryProposal(obj: Record<string, unknown>): WeeklyMemoryUpdateProposal {
  return {
    latestWeeklySummary: requireString({ obj, key: 'latestWeeklySummary' }),
    updatedChecklistStatuses: validateChecklistStatuses({ obj, key: 'updatedChecklistStatuses' }),
    newDecisions: requireStringArray({ obj, key: 'newDecisions' }),
    updatedBlockers: requireStringArray({ obj, key: 'updatedBlockers' }),
    nextActions: requireStringArray({ obj, key: 'nextActions' }),
    demoStorySummary: requireString({ obj, key: 'demoStorySummary' }),
    filesWorthShowing: requireStringArray({ obj, key: 'filesWorthShowing' }),
  };
}

// --- shared object-argument validation helpers ---

function requireObjectValue({ value, label }: { value: unknown; label: string }): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new SkillError('INVALID_OUTPUT', `${label} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

function requireObject({ obj, key }: { obj: Record<string, unknown>; key: string }): Record<string, unknown> {
  return requireObjectValue({ value: obj[key], label: `Field "${key}"` });
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
  return val.map((item, i) => requireObjectValue({ value: item, label: `${key}[${i}]` }));
}

function requireString({ obj, key }: { obj: Record<string, unknown>; key: string }): string {
  const val = obj[key];
  if (typeof val !== 'string' || val.trim() === '') {
    throw new SkillError('INVALID_OUTPUT', `Missing or empty string field: "${key}".`);
  }
  return val;
}

function requireStringArray({ obj, key }: { obj: Record<string, unknown>; key: string }): string[] {
  const val = obj[key];
  if (!Array.isArray(val)) {
    throw new SkillError('INVALID_OUTPUT', `Field "${key}" must be an array.`);
  }
  return val.map((item, i) => {
    if (typeof item !== 'string') {
      throw new SkillError('INVALID_OUTPUT', `All items in "${key}" must be strings (index ${i}).`);
    }
    return item;
  });
}

function requireNestedString({
  entry,
  label,
  field,
}: {
  entry: Record<string, unknown>;
  label: string;
  field: string;
}): string {
  const val = entry[field];
  if (typeof val !== 'string' || val.trim() === '') {
    throw new SkillError('INVALID_OUTPUT', `${label}.${field} must be a non-empty string.`);
  }
  return val;
}

function optionalNestedString({
  entry,
  label,
  field,
}: {
  entry: Record<string, unknown>;
  label: string;
  field: string;
}): string | undefined {
  const val = entry[field];
  if (val === undefined || val === null || val === '') return undefined;
  if (typeof val !== 'string') {
    throw new SkillError('INVALID_OUTPUT', `${label}.${field} must be a string when present.`);
  }
  return val;
}

function requireEnum<T extends string>({
  value,
  allowed,
  ctx,
}: {
  value: unknown;
  allowed: readonly T[];
  ctx: string;
}): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new SkillError(
      'INVALID_OUTPUT',
      `${ctx} must be one of: ${allowed.join(', ')}. Got: ${String(value)}.`,
    );
  }
  return value as T;
}
