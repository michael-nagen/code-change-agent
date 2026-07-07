import { SkillError } from '../../errors/SkillError.js';
import type { RequirementAlignment } from './types.js';

const VALID_CONFIDENCE_VALUES = ['high', 'medium', 'low'] as const;

/**
 * Tolerates JSON wrapped in markdown code fences (```json ... ``` or
 * ``` ... ```) in case the model adds them despite instructions not to.
 *
 * Throws SkillError('INVALID_OUTPUT') if the output cannot be parsed or
 * fails structural validation. Never returns partial data.
 */
export function parseOutput(text: string): RequirementAlignment {
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

function validate(raw: unknown): RequirementAlignment {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new SkillError('INVALID_OUTPUT', 'Model output must be a JSON object.');
  }

  const obj = raw as Record<string, unknown>;

  return {
    requirementSummary: requireString({ obj, key: 'requirementSummary' }),
    satisfiedItems: requireStringArray({ obj, key: 'satisfiedItems' }),
    partiallySatisfiedItems: requireStringArray({ obj, key: 'partiallySatisfiedItems' }),
    missingItems: requireStringArray({ obj, key: 'missingItems' }),
    unclearItems: requireStringArray({ obj, key: 'unclearItems' }),
    overallAssessment: requireString({ obj, key: 'overallAssessment' }),
    confidence: requireConfidence({ obj, key: 'confidence' }),
  };
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

function requireConfidence({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): RequirementAlignment['confidence'] {
  const val = obj[key];
  if (
    typeof val !== 'string' ||
    !(VALID_CONFIDENCE_VALUES as readonly string[]).includes(val)
  ) {
    throw new SkillError(
      'INVALID_OUTPUT',
      `Field "${key}" must be one of: ${VALID_CONFIDENCE_VALUES.join(', ')}. Got: ${String(val)}.`,
    );
  }
  return val as RequirementAlignment['confidence'];
}
