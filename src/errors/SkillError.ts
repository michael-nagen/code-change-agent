/**
 * Typed errors for the skill layer so callers can branch on a code rather than
 * parsing message strings.
 */
export type SkillErrorCode = 'INVALID_OUTPUT';

export class SkillError extends Error {
  readonly code: SkillErrorCode;

  constructor(code: SkillErrorCode, message: string) {
    super(message);
    this.name = 'SkillError';
    this.code = code;
    // Restore prototype chain for instanceof across transpilation targets.
    Object.setPrototypeOf(this, SkillError.prototype);
  }
}
