/**
 * Typed errors for the source-integration layer (Notion/GitHub connectors and
 * config), so callers can branch on a code rather than parsing message strings.
 *
 * - CONFIG    — integrations enabled but misconfigured (e.g. missing API key).
 * - NOT_FOUND — the requested page/PR was not found or is not accessible.
 * - FETCH     — the network request failed or returned an unexpected status.
 * - VALIDATION— an input (e.g. URL/page id) was invalid.
 */
export type SourceErrorCode = 'CONFIG' | 'NOT_FOUND' | 'FETCH' | 'VALIDATION';

export class SourceError extends Error {
  readonly code: SourceErrorCode;

  constructor(code: SourceErrorCode, message: string) {
    super(message);
    this.name = 'SourceError';
    this.code = code;
    // Restore prototype chain for instanceof across transpilation targets.
    Object.setPrototypeOf(this, SourceError.prototype);
  }
}
