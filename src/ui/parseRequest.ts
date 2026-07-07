/**
 * Parse + validate an untrusted request body (from the browser) into a typed
 * `FormSubmission`. Validation here is intentionally minimal: it shields the
 * handler from malformed JSON shapes and unknown input modes. Field-level rules
 * (empty requirement/diff, include-flag dependencies) are left to the engine so
 * the UI shows the engine's real messages; mode-specific rules (bad URL, empty
 * fetched diff) live in `normalizeInput`.
 */
import { INPUT_MODES, type FormSubmission, type InputMode } from './types.js';

export class RequestParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RequestParseError';
  }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asBool(value: unknown): boolean {
  return value === true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseInputMode(value: unknown): InputMode {
  if (value === undefined || value === '') return 'manual';
  if (typeof value === 'string' && (INPUT_MODES as readonly string[]).includes(value)) {
    return value as InputMode;
  }
  throw new RequestParseError(`Unsupported inputMode: ${String(value)}`);
}

/**
 * Build a `FormSubmission` from a parsed JSON body. Throws `RequestParseError`
 * for a non-object body or an unknown `inputMode`. `inputMode` defaults to
 * `manual` when omitted, preserving the original manual-only behavior.
 */
export function parseFormSubmission(body: unknown): FormSubmission {
  if (!isRecord(body)) {
    throw new RequestParseError('Request body must be a JSON object.');
  }

  const projectName = asString(body.projectName).trim();
  const sessionId = asString(body.sessionId).trim();

  const submission: FormSubmission = {
    inputMode: parseInputMode(body.inputMode),
    requirementText: asString(body.requirementText),
    rawDiff: asString(body.rawDiff),
    githubUrl: asString(body.githubUrl).trim(),
    websiteUrl: asString(body.websiteUrl).trim(),
    notionText: asString(body.notionText),
    includeFlow: asBool(body.includeFlow),
    includeGapReport: asBool(body.includeGapReport),
    includePrDescription: asBool(body.includePrDescription),
    includeVideoScript: asBool(body.includeVideoScript),
    includeDailyUpdate: asBool(body.includeDailyUpdate),
  };

  if (projectName !== '') {
    submission.projectName = projectName;
  }
  if (sessionId !== '') {
    submission.sessionId = sessionId;
  }

  return submission;
}
