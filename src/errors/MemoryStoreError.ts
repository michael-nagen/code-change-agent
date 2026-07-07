/**
 * Typed errors for the MemoryStore so callers can branch programmatically
 * rather than parsing message strings.
 *
 * - VALIDATION — the memory value handed in (or persisted) has the wrong shape.
 * - CORRUPTED  — a persisted record could not be parsed/validated on read.
 * - IO         — the underlying storage failed (filesystem/DB/network).
 */
export type MemoryStoreErrorCode = 'VALIDATION' | 'CORRUPTED' | 'IO';

export class MemoryStoreError extends Error {
  readonly code: MemoryStoreErrorCode;

  constructor(code: MemoryStoreErrorCode, message: string) {
    super(message);
    this.name = 'MemoryStoreError';
    this.code = code;
    // Restore prototype chain for instanceof across transpilation targets.
    Object.setPrototypeOf(this, MemoryStoreError.prototype);
  }
}
