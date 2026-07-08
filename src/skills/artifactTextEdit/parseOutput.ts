/**
 * Parse + validate the text-edit model output, failing closed on anything
 * invalid. Tolerates JSON wrapped in markdown code fences. A missing or empty
 * "text" is an error (we must never send an empty artifact); "changeSummary" is
 * optional and defaults to a neutral note.
 */
import { SkillError } from '../../errors/SkillError.js';
import type { ArtifactTextEditResult } from './types.js';

export function parseOutput(text: string): ArtifactTextEditResult {
  const json = extractJson(text);
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new SkillError(
      'INVALID_OUTPUT',
      `Edit output is not valid JSON. First 200 chars: ${json.slice(0, 200)}`,
    );
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new SkillError('INVALID_OUTPUT', 'Edit output must be a JSON object.');
  }

  const obj = raw as Record<string, unknown>;
  const revised = obj.text;
  if (typeof revised !== 'string' || revised.trim() === '') {
    throw new SkillError('INVALID_OUTPUT', 'Edit output must include a non-empty "text".');
  }

  const summary = obj.changeSummary;
  const changeSummary =
    typeof summary === 'string' && summary.trim() !== '' ? summary.trim() : 'Edited.';

  return { text: revised, changeSummary };
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch !== null && fenceMatch[1] !== undefined) return fenceMatch[1];
  return trimmed;
}
