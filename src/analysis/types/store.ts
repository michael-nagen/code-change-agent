/**
 * The ArtifactStore abstraction.
 *
 * It stores and retrieves whole sessions (which carry their artifacts) so the
 * Harness can reuse previously computed skill outputs instead of recomputing
 * them. The V1 implementation is in-memory; the interface is intentionally
 * narrow so it can later be backed by a database or file store without changing
 * any caller.
 */
import type { AnalysisSession } from './session.js';

export interface ArtifactStore {
  /** Persist (insert or replace) a session and its artifacts. */
  save(session: AnalysisSession): void;
  /** Retrieve a session by id, or undefined if it does not exist. */
  get(sessionId: string): AnalysisSession | undefined;
}
