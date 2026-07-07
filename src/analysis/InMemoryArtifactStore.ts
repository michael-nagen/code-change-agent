import type { AnalysisSession } from './types/index.js';
import type { ArtifactStore } from './types/index.js';

/**
 * In-memory ArtifactStore (V1: no persistence). Sessions are cloned on the way
 * in and out so callers cannot mutate stored state by holding a reference —
 * the same isolation guarantee a database-backed store would provide.
 */
export class InMemoryArtifactStore implements ArtifactStore {
  private readonly sessions = new Map<string, AnalysisSession>();

  save(session: AnalysisSession): void {
    this.sessions.set(session.sessionId, structuredClone(session));
  }

  get(sessionId: string): AnalysisSession | undefined {
    const session = this.sessions.get(sessionId);
    return session === undefined ? undefined : structuredClone(session);
  }
}
