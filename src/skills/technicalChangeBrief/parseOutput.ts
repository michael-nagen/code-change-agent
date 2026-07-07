import { SkillError } from '../../errors/SkillError.js';
import type {
  BackwardCompatibility,
  DataSchemaChanges,
  EvidenceLevel,
  FileWorthShowing,
  HowItWorksStep,
  InputApiFlag,
  InputApiKind,
  InterestingFunctionality,
  ModelOrType,
  SchemaChangeItem,
  TechnicalChangeBrief,
  UiChanges,
  WorkflowRuntimeChanges,
} from './types.js';

const VALID_EVIDENCE: readonly EvidenceLevel[] = ['confirmed', 'inferred'];

const VALID_BACKWARD_COMPAT: readonly BackwardCompatibility[] = [
  'compatible',
  'breaking',
  'unclear',
];

const VALID_INPUT_API_KINDS: readonly InputApiKind[] = [
  'includeFlag',
  'requestField',
  'optionalInput',
  'requiredInput',
  'artifactKey',
  'route',
  'other',
];

/**
 * Tolerates JSON wrapped in markdown code fences in case the model adds them
 * despite instructions not to.
 *
 * Throws SkillError('INVALID_OUTPUT') if the output cannot be parsed or fails
 * structural validation. Never returns partial data.
 */
export function parseOutput(text: string): TechnicalChangeBrief {
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

function validate(raw: unknown): TechnicalChangeBrief {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new SkillError('INVALID_OUTPUT', 'Model output must be a JSON object.');
  }

  const obj = raw as Record<string, unknown>;

  return {
    executiveSummary: requireString({ obj, key: 'executiveSummary' }),
    dataSchemaChanges: requireDataSchemaChanges({ obj, key: 'dataSchemaChanges' }),
    modelsAndTypes: requireModelsAndTypes({ obj, key: 'modelsAndTypes' }),
    inputsApiFlags: requireInputsApiFlags({ obj, key: 'inputsApiFlags' }),
    workflowRuntimeChanges: requireWorkflowRuntimeChanges({ obj, key: 'workflowRuntimeChanges' }),
    uiChanges: requireUiChanges({ obj, key: 'uiChanges' }),
    interestingFunctionality: requireInterestingFunctionality({
      obj,
      key: 'interestingFunctionality',
    }),
    howItWorksStepByStep: requireHowItWorksSteps({ obj, key: 'howItWorksStepByStep' }),
    filesWorthShowing: requireFilesWorthShowing({ obj, key: 'filesWorthShowing' }),
    talkingPoints: requireStringArray({ obj, key: 'talkingPoints' }),
  };
}

function requireSchemaChangeItems({
  entry,
  key,
  field,
}: {
  entry: Record<string, unknown>;
  key: string;
  field: string;
}): SchemaChangeItem[] {
  return requireNestedObjectArray({ entry, key, field }).map((item) => {
    const filePath = optionalNestedString({ entry: item, key: `${key}.${field}`, field: 'filePath' });
    const result: SchemaChangeItem = {
      name: requireNestedString({ entry: item, key: `${key}.${field}`, field: 'name' }),
      description: requireNestedString({ entry: item, key: `${key}.${field}`, field: 'description' }),
      evidence: requireNestedEvidence({ entry: item, key: `${key}.${field}`, field: 'evidence' }),
      ...(filePath !== undefined ? { filePath } : {}),
    };
    return result;
  });
}

function requireDataSchemaChanges({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): DataSchemaChanges {
  const entry = requireObject({ obj, key });
  return {
    hasChanges: requireNestedBoolean({ entry, key, field: 'hasChanges' }),
    summary: requireNestedString({ entry, key, field: 'summary' }),
    newFields: requireSchemaChangeItems({ entry, key, field: 'newFields' }),
    changedFields: requireSchemaChangeItems({ entry, key, field: 'changedFields' }),
    removedFields: requireSchemaChangeItems({ entry, key, field: 'removedFields' }),
    newSchemas: requireSchemaChangeItems({ entry, key, field: 'newSchemas' }),
    changedParserContracts: requireSchemaChangeItems({ entry, key, field: 'changedParserContracts' }),
    newStatusValues: requireSchemaChangeItems({ entry, key, field: 'newStatusValues' }),
    persistedDataImpact: requireNestedString({ entry, key, field: 'persistedDataImpact' }),
    backwardCompatibility: requireNestedBackwardCompatibility({
      entry,
      key,
      field: 'backwardCompatibility',
    }),
    backwardCompatibilityNote: requireNestedString({ entry, key, field: 'backwardCompatibilityNote' }),
  };
}

function requireModelsAndTypes({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): ModelOrType[] {
  return requireObjectArray({ obj, key }).map((entry) => {
    const filePath = optionalNestedString({ entry, key, field: 'filePath' });
    const result: ModelOrType = {
      name: requireNestedString({ entry, key, field: 'name' }),
      represents: requireNestedString({ entry, key, field: 'represents' }),
      whyNeeded: requireNestedString({ entry, key, field: 'whyNeeded' }),
      importantFields: requireNestedStringArray({ entry, key, field: 'importantFields' }),
      evidence: requireNestedEvidence({ entry, key, field: 'evidence' }),
      ...(filePath !== undefined ? { filePath } : {}),
    };
    return result;
  });
}

function requireInputsApiFlags({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): InputApiFlag[] {
  return requireObjectArray({ obj, key }).map((entry) => {
    const filePath = optionalNestedString({ entry, key, field: 'filePath' });
    const result: InputApiFlag = {
      name: requireNestedString({ entry, key, field: 'name' }),
      kind: requireNestedInputApiKind({ entry, key, field: 'kind' }),
      description: requireNestedString({ entry, key, field: 'description' }),
      evidence: requireNestedEvidence({ entry, key, field: 'evidence' }),
      ...(filePath !== undefined ? { filePath } : {}),
    };
    return result;
  });
}

function requireWorkflowRuntimeChanges({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): WorkflowRuntimeChanges {
  const entry = requireObject({ obj, key });
  return {
    summary: requireNestedString({ entry, key, field: 'summary' }),
    whereItRuns: requireNestedString({ entry, key, field: 'whereItRuns' }),
    dependsOn: requireNestedStringArray({ entry, key, field: 'dependsOn' }),
    consumesArtifacts: requireNestedStringArray({ entry, key, field: 'consumesArtifacts' }),
    producesArtifact: requireNestedString({ entry, key, field: 'producesArtifact' }),
    cachedOrReused: requireNestedString({ entry, key, field: 'cachedOrReused' }),
    behaviorWhenFlagOff: requireNestedString({ entry, key, field: 'behaviorWhenFlagOff' }),
  };
}

function requireUiChanges({ obj, key }: { obj: Record<string, unknown>; key: string }): UiChanges {
  const entry = requireObject({ obj, key });
  return {
    hasChanges: requireNestedBoolean({ entry, key, field: 'hasChanges' }),
    summary: requireNestedString({ entry, key, field: 'summary' }),
    newCardsOrViews: requireNestedStringArray({ entry, key, field: 'newCardsOrViews' }),
    togglesOrButtons: requireNestedStringArray({ entry, key, field: 'togglesOrButtons' }),
    copyActions: requireNestedStringArray({ entry, key, field: 'copyActions' }),
    sectionsDisplayed: requireNestedStringArray({ entry, key, field: 'sectionsDisplayed' }),
    howToActivate: requireNestedString({ entry, key, field: 'howToActivate' }),
  };
}

function requireInterestingFunctionality({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): InterestingFunctionality[] {
  return requireObjectArray({ obj, key }).map((entry) => ({
    title: requireNestedString({ entry, key, field: 'title' }),
    whatItDoes: requireNestedString({ entry, key, field: 'whatItDoes' }),
    whyItMatters: requireNestedString({ entry, key, field: 'whyItMatters' }),
    howItWorks: requireNestedString({ entry, key, field: 'howItWorks' }),
    filesInvolved: requireNestedStringArray({ entry, key, field: 'filesInvolved' }),
  }));
}

function requireHowItWorksSteps({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): HowItWorksStep[] {
  return requireObjectArray({ obj, key }).map((entry) => {
    const actor = optionalNestedString({ entry, key, field: 'actor' });
    const detail = optionalNestedString({ entry, key, field: 'detail' });
    const step: HowItWorksStep = {
      action: requireNestedString({ entry, key, field: 'action' }),
      ...(actor !== undefined ? { actor } : {}),
      ...(detail !== undefined ? { detail } : {}),
    };
    return step;
  });
}

function requireFilesWorthShowing({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): FileWorthShowing[] {
  return requireObjectArray({ obj, key }).map((entry) => ({
    path: requireNestedString({ entry, key, field: 'path' }),
    whyItMatters: requireNestedString({ entry, key, field: 'whyItMatters' }),
    whatToPointOut: requireNestedString({ entry, key, field: 'whatToPointOut' }),
  }));
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
  const val = obj[key];
  if (!Array.isArray(val)) {
    throw new SkillError('INVALID_OUTPUT', `Field "${key}" must be an array.`);
  }
  const result: string[] = [];
  for (const item of val) {
    if (typeof item !== 'string') {
      throw new SkillError('INVALID_OUTPUT', `All items in "${key}" must be strings.`);
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

function requireNestedObjectArray({
  entry,
  key,
  field,
}: {
  entry: Record<string, unknown>;
  key: string;
  field: string;
}): Record<string, unknown>[] {
  const val = entry[field];
  if (!Array.isArray(val)) {
    throw new SkillError('INVALID_OUTPUT', `${key}.${field} must be an array.`);
  }
  const result: Record<string, unknown>[] = [];
  for (const item of val) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new SkillError('INVALID_OUTPUT', `All items in ${key}.${field} must be objects.`);
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

function requireNestedBoolean({
  entry,
  key,
  field,
}: {
  entry: Record<string, unknown>;
  key: string;
  field: string;
}): boolean {
  const val = entry[field];
  if (typeof val !== 'boolean') {
    throw new SkillError('INVALID_OUTPUT', `${key}.${field} must be a boolean.`);
  }
  return val;
}

function requireNestedEvidence({
  entry,
  key,
  field,
}: {
  entry: Record<string, unknown>;
  key: string;
  field: string;
}): EvidenceLevel {
  const val = entry[field];
  if (typeof val !== 'string' || !(VALID_EVIDENCE as readonly string[]).includes(val)) {
    throw new SkillError(
      'INVALID_OUTPUT',
      `${key}.${field} must be one of: ${VALID_EVIDENCE.join(', ')}. Got: ${String(val)}.`,
    );
  }
  return val as EvidenceLevel;
}

function requireNestedBackwardCompatibility({
  entry,
  key,
  field,
}: {
  entry: Record<string, unknown>;
  key: string;
  field: string;
}): BackwardCompatibility {
  const val = entry[field];
  if (typeof val !== 'string' || !(VALID_BACKWARD_COMPAT as readonly string[]).includes(val)) {
    throw new SkillError(
      'INVALID_OUTPUT',
      `${key}.${field} must be one of: ${VALID_BACKWARD_COMPAT.join(', ')}. Got: ${String(val)}.`,
    );
  }
  return val as BackwardCompatibility;
}

function requireNestedInputApiKind({
  entry,
  key,
  field,
}: {
  entry: Record<string, unknown>;
  key: string;
  field: string;
}): InputApiKind {
  const val = entry[field];
  if (typeof val !== 'string' || !(VALID_INPUT_API_KINDS as readonly string[]).includes(val)) {
    throw new SkillError(
      'INVALID_OUTPUT',
      `${key}.${field} must be one of: ${VALID_INPUT_API_KINDS.join(', ')}. Got: ${String(val)}.`,
    );
  }
  return val as InputApiKind;
}
