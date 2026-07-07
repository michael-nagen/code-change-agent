import { SkillError } from '../../errors/SkillError.js';
import type { VideoScript, VideoScriptSection } from './types.js';

/**
 * Tolerates JSON wrapped in markdown code fences in case the model adds them
 * despite instructions not to.
 *
 * Throws SkillError('INVALID_OUTPUT') if the output cannot be parsed or fails
 * structural validation. Never returns partial data.
 */
export function parseOutput(text: string): VideoScript {
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

function validate(raw: unknown): VideoScript {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new SkillError('INVALID_OUTPUT', 'Model output must be a JSON object.');
  }

  const obj = raw as Record<string, unknown>;

  return {
    title: requireString({ obj, key: 'title' }),
    targetAudience: requireString({ obj, key: 'targetAudience' }),
    estimatedDuration: requireString({ obj, key: 'estimatedDuration' }),
    sections: requireSections({ obj, key: 'sections' }),
    keyTakeaways: requireStringArray({ obj, key: 'keyTakeaways' }),
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

function requireSections({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): VideoScriptSection[] {
  const val = obj[key];
  if (!Array.isArray(val)) {
    throw new SkillError('INVALID_OUTPUT', `Field "${key}" must be an array.`);
  }

  const result: VideoScriptSection[] = [];
  let i = 0;

  for (const item of val) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new SkillError('INVALID_OUTPUT', `${key}[${i}] must be an object.`);
    }

    const entry = item as Record<string, unknown>;
    result.push({
      title: requireSectionString({ entry, key, index: i, field: 'title' }),
      narration: requireSectionString({ entry, key, index: i, field: 'narration' }),
      visualCue: requireSectionString({ entry, key, index: i, field: 'visualCue' }),
    });
    i++;
  }

  if (result.length === 0) {
    throw new SkillError('INVALID_OUTPUT', `Field "${key}" must contain at least one section.`);
  }

  return result;
}

function requireSectionString({
  entry,
  key,
  index,
  field,
}: {
  entry: Record<string, unknown>;
  key: string;
  index: number;
  field: string;
}): string {
  const val = entry[field];
  if (typeof val !== 'string' || val.trim() === '') {
    throw new SkillError(
      'INVALID_OUTPUT',
      `${key}[${index}].${field} must be a non-empty string.`,
    );
  }
  return val;
}
