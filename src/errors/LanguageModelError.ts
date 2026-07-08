/**
 * Typed errors for LanguageModel provider adapters so callers can branch on a
 * code rather than parsing message strings.
 *
 * - CONFIG           — required configuration (e.g. an API key) is missing or invalid.
 * - REQUEST          — the provider request failed or returned a non-2xx status.
 * - TIMEOUT          — the provider request was aborted after exceeding the timeout.
 * - INVALID_RESPONSE — the provider responded but without usable text content.
 */
export type LanguageModelErrorCode = 'CONFIG' | 'REQUEST' | 'TIMEOUT' | 'INVALID_RESPONSE';

export class LanguageModelError extends Error {
  readonly code: LanguageModelErrorCode;

  constructor(code: LanguageModelErrorCode, message: string) {
    super(message);
    this.name = 'LanguageModelError';
    this.code = code;
    // Restore prototype chain for instanceof across transpilation targets.
    Object.setPrototypeOf(this, LanguageModelError.prototype);
  }
}
