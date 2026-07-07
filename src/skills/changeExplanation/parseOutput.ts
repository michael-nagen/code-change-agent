import { SkillError } from '../../errors/SkillError.js';
import type { ChangeExplanation } from './types.js';

/**
 * Tolerates JSON wrapped in markdown code fences (```json ... ``` or
 * ``` ... ```) in case the model adds them despite instructions not to.
 *
 * Throws SkillError('INVALID_OUTPUT') if the output cannot be parsed or
 * fails structural validation. Never returns partial data.
 */
export function parseOutput(text: string): ChangeExplanation {
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

function validate(raw: unknown): ChangeExplanation {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new SkillError('INVALID_OUTPUT', 'Model output must be a JSON object.');
  }

  const obj = raw as Record<string, unknown>;

  return {
    changeStory: requireString({ obj, key: 'changeStory' }),
    keyFunctionalities: requireStringArray({ obj, key: 'keyFunctionalities' }),
    flow: requireStringArray({ obj, key: 'flow' }),
    mainComponents: requireMainComponents({ obj, key: 'mainComponents' }),
    architecturalDecisions: requireStringArray({ obj, key: 'architecturalDecisions' }),
    impactAnalysis: requireStringArray({ obj, key: 'impactAnalysis' }),
    uncertainties: requireStringArray({ obj, key: 'uncertainties' }),
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

function requireMainComponents({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): ChangeExplanation['mainComponents'] {
  const val = obj[key];
  if (!Array.isArray(val)) {
    throw new SkillError('INVALID_OUTPUT', `Field "${key}" must be an array.`);
  }

  const result: ChangeExplanation['mainComponents'] = [];
  let i = 0;

  for (const item of val) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new SkillError('INVALID_OUTPUT', `${key}[${i}] must be an object.`);
    }

    const entry = item as Record<string, unknown>;
    const name = entry['name'];
    const responsibility = entry['responsibility'];

    if (typeof name !== 'string' || name.trim() === '') {
      throw new SkillError('INVALID_OUTPUT', `${key}[${i}].name must be a non-empty string.`);
    }
    if (typeof responsibility !== 'string' || responsibility.trim() === '') {
      throw new SkillError(
        'INVALID_OUTPUT',
        `${key}[${i}].responsibility must be a non-empty string.`,
      );
    }

    result.push({ name, responsibility });
    i++;
  }

  return result;
}
