/**
 * Typed errors for the tool layer so callers can branch on a code rather than
 * parsing message strings.
 */
export type ToolErrorCode = 'VALIDATION' | 'NOT_A_GIT_REPO' | 'GIT_COMMAND_FAILED';

export class ToolError extends Error {
  readonly code: ToolErrorCode;

  constructor(code: ToolErrorCode, message: string) {
    super(message);
    this.name = 'ToolError';
    this.code = code;
    // Restore prototype chain for instanceof across transpilation targets.
    Object.setPrototypeOf(this, ToolError.prototype);
  }
}
