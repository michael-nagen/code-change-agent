import { SkillError } from '../../errors/SkillError.js';
import type { DailyUpdate, HighlightedTopic } from './types.js';

/**
 * Tolerates JSON wrapped in markdown code fences in case the model adds them
 * despite instructions not to.
 *
 * Throws SkillError('INVALID_OUTPUT') if the output cannot be parsed or fails
 * structural validation. Never returns partial data.
 */
export function parseOutput(text: string): DailyUpdate {
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

function validate(raw: unknown): DailyUpdate {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new SkillError('INVALID_OUTPUT', 'Model output must be a JSON object.');
  }

  const obj = raw as Record<string, unknown>;

  return {
    headline: requireString({ obj, key: 'headline' }),
    yesterdaySummary: requireStringArray({ obj, key: 'yesterdaySummary' }),
    todaySuggestions: requireStringArray({ obj, key: 'todaySuggestions' }),
    blockersOrRisks: requireStringArray({ obj, key: 'blockersOrRisks' }),
    highlightedTopic: requireHighlightedTopic({ obj, key: 'highlightedTopic' }),
    spokenVersion: requireString({ obj, key: 'spokenVersion' }),
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

function requireHighlightedTopic({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): HighlightedTopic {
  const val = obj[key];
  if (typeof val !== 'object' || val === null || Array.isArray(val)) {
    throw new SkillError('INVALID_OUTPUT', `Field "${key}" must be an object.`);
  }

  const entry = val as Record<string, unknown>;
  return {
    title: requireNestedString({ entry, key, field: 'title' }),
    explanation: requireNestedString({ entry, key, field: 'explanation' }),
    whyItMatters: requireNestedString({ entry, key, field: 'whyItMatters' }),
  };
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
