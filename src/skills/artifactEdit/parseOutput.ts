import { SkillError } from '../../errors/SkillError.js';
import { parseOutput as parsePrDescription } from '../prDescription/parseOutput.js';
import { parseOutput as parseVideoScript } from '../videoScript/parseOutput.js';
import { parseOutput as parseDailyUpdate } from '../dailyUpdate/parseOutput.js';
import type { ArtifactEditResult, EditableArtifact, EditableArtifactKey } from './types.js';

/**
 * Parse and validate the model's edit output.
 *
 * Tolerates JSON wrapped in markdown code fences. Throws
 * SkillError('INVALID_OUTPUT') on unparseable JSON or any schema mismatch —
 * including when `updatedArtifact` does not match the schema of
 * `selectedArtifactKey`. Never returns partial data (fails closed).
 *
 * `updatedArtifact` is validated by round-tripping it through the SAME parser
 * the artifact's own generation skill uses, so an edited artifact is held to
 * the identical schema contract.
 */
export function parseOutput(
  text: string,
  selectedArtifactKey: EditableArtifactKey,
): ArtifactEditResult {
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

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new SkillError('INVALID_OUTPUT', 'Model output must be a JSON object.');
  }

  const obj = raw as Record<string, unknown>;
  const assistantMessage = requireString({ obj, key: 'assistantMessage' });
  const changeSummary = requireString({ obj, key: 'changeSummary' });
  const updatedArtifact = validateArtifact(selectedArtifactKey, obj['updatedArtifact']);

  return { assistantMessage, updatedArtifact, changeSummary };
}

function validateArtifact(key: EditableArtifactKey, value: unknown): EditableArtifact {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new SkillError('INVALID_OUTPUT', 'Field "updatedArtifact" must be an object.');
  }
  // Re-validate against the artifact's canonical parser so an edited artifact
  // is held to the exact schema of its key. A mismatched shape fails closed.
  const serialized = JSON.stringify(value);
  switch (key) {
    case 'prDescription':
      return parsePrDescription(serialized);
    case 'videoScript':
      return parseVideoScript(serialized);
    case 'dailyUpdate':
      return parseDailyUpdate(serialized);
    default: {
      const exhaustive: never = key;
      throw new SkillError('INVALID_OUTPUT', `Unsupported artifact key: ${String(exhaustive)}.`);
    }
  }
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

function requireString({ obj, key }: { obj: Record<string, unknown>; key: string }): string {
  const val = obj[key];
  if (typeof val !== 'string' || val.trim() === '') {
    throw new SkillError('INVALID_OUTPUT', `Missing or empty string field: "${key}".`);
  }
  return val;
}
