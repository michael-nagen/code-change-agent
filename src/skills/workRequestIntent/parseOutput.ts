/**
 * Parse + validate the intent model output, failing closed on anything invalid.
 *
 * Tolerates JSON wrapped in markdown code fences. An unrecognized action is NOT
 * an error — it is coerced to "unknown" so the caller falls back gracefully —
 * but malformed JSON or a wrong-typed optional field fails closed.
 */
import { SkillError } from '../../errors/SkillError.js';
import type { WorkRequestAction, WorkRequestIntent } from './types.js';

const VALID_ACTIONS: readonly WorkRequestAction[] = [
  'analyze',
  'daily',
  'technical',
  'demo',
  'weekly',
  'status',
  'summary',
  'memory',
  'projects',
  'latest',
  'save',
  'clear',
  'preferences',
  'help',
  'unknown',
];

export function parseOutput(text: string): WorkRequestIntent {
  const json = extractJson(text);
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new SkillError(
      'INVALID_OUTPUT',
      `Intent output is not valid JSON. First 200 chars: ${json.slice(0, 200)}`,
    );
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new SkillError('INVALID_OUTPUT', 'Intent output must be a JSON object.');
  }

  const obj = raw as Record<string, unknown>;
  const action = coerceAction(obj.action);
  const projectName = optionalString(obj.projectName);
  const spec = optionalString(obj.spec);
  const diff = optionalString(obj.diff);
  const saveSource = coerceSaveSource(obj.saveSource);

  return {
    action,
    ...(projectName !== undefined ? { projectName } : {}),
    ...(spec !== undefined ? { spec } : {}),
    ...(diff !== undefined ? { diff } : {}),
    ...(saveSource !== undefined ? { saveSource } : {}),
  };
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch !== null && fenceMatch[1] !== undefined) return fenceMatch[1];
  return trimmed;
}

function coerceAction(value: unknown): WorkRequestAction {
  if (typeof value === 'string' && (VALID_ACTIONS as readonly string[]).includes(value)) {
    return value as WorkRequestAction;
  }
  return 'unknown';
}

function coerceSaveSource(value: unknown): 'daily' | 'weekly' | undefined {
  if (value === 'daily' || value === 'weekly') return value;
  return undefined;
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new SkillError('INVALID_OUTPUT', 'Optional intent fields must be strings when present.');
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}
