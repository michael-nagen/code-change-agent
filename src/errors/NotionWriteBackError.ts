/**
 * Typed errors for the explicit Notion write-back path, so callers can branch on
 * a code rather than parsing message strings. Messages are always safe to show
 * to the user and NEVER contain the Notion API key or other secrets.
 *
 * - NOT_CONFIGURED  — Notion write-back is off (no API key / connector wired).
 * - NO_PAGE         — no target page id/URL from the request or env default.
 * - MISSING_ARTIFACT— the artifact to send has not been generated / saved yet.
 */
export type NotionWriteBackErrorCode = 'NOT_CONFIGURED' | 'NO_PAGE' | 'MISSING_ARTIFACT';

export class NotionWriteBackError extends Error {
  readonly code: NotionWriteBackErrorCode;

  constructor(code: NotionWriteBackErrorCode, message: string) {
    super(message);
    this.name = 'NotionWriteBackError';
    this.code = code;
    // Restore prototype chain for instanceof across transpilation targets.
    Object.setPrototypeOf(this, NotionWriteBackError.prototype);
  }
}
