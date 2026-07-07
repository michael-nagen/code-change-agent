/**
 * Typed errors for the ProjectStore so callers can branch programmatically
 * rather than parsing message strings.
 */
export type ProjectStoreErrorCode = 'NOT_FOUND' | 'VALIDATION';

export class ProjectStoreError extends Error {
  readonly code: ProjectStoreErrorCode;

  constructor(code: ProjectStoreErrorCode, message: string) {
    super(message);
    this.name = 'ProjectStoreError';
    this.code = code;
    // Restore prototype chain for instanceof across transpilation targets.
    Object.setPrototypeOf(this, ProjectStoreError.prototype);
  }
}
