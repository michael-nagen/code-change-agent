import type { SessionInputs } from '../types/session.js';
import { HarnessError } from '../errors/HarnessError.js';

/**
 * Pure input guard. Not business reasoning — just structural validation that
 * the Harness has something to work with.
 */
export function validateInputs(inputs: SessionInputs): void {
  if (typeof inputs?.requirement !== 'string' || inputs.requirement.trim() === '') {
    throw new HarnessError('VALIDATION', 'A non-empty `requirement` is required.');
  }
  if (typeof inputs?.diff !== 'string' || inputs.diff.trim() === '') {
    throw new HarnessError('VALIDATION', 'A non-empty `diff` is required.');
  }
}
