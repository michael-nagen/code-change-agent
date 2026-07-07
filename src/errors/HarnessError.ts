/**
 * Typed errors so callers can branch programmatically rather than parsing
 * message strings.
 */
export type HarnessErrorCode =
  | 'VALIDATION'
  | 'INVALID_PHASE'
  | 'UNKNOWN_GENERATOR'
  | 'UNKNOWN_SKILL';

export class HarnessError extends Error {
  readonly code: HarnessErrorCode;

  constructor(code: HarnessErrorCode, message: string) {
    super(message);
    this.name = 'HarnessError';
    this.code = code;
    // Restore prototype chain for instanceof across transpilation targets.
    Object.setPrototypeOf(this, HarnessError.prototype);
  }
}
