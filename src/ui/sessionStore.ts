/**
 * In-memory, UI-layer session store for chat editing.
 *
 * The analysis engine already keeps its own artifact store; this is a thin,
 * UI-owned cache of the full `AnalysisResult` per session PLUS a minimal undo
 * history. It exists so the chat-edit and undo endpoints can read and replace a
 * single artifact WITHOUT re-running any analysis. There is NO persistence:
 * everything is held in memory and lost on restart, by design.
 *
 * Isolation: results are cloned on the way in and out, so callers cannot mutate
 * stored state by holding a reference.
 */
import type { AnalysisResult } from '../analysis/index.js';
import type { PRDescription } from '../skills/prDescription/index.js';
import type { VideoScript } from '../skills/videoScript/index.js';
import type { DailyUpdate } from '../skills/dailyUpdate/index.js';
import type { DailyWorkGuidance } from '../skills/dailyWorkGuidance/index.js';
import type { EditableArtifact, EditableArtifactKey } from '../skills/artifactEdit/index.js';

/** The artifact keys editable via chat in v1. */
export const EDITABLE_ARTIFACT_KEYS: readonly EditableArtifactKey[] = [
  'prDescription',
  'dailyUpdate',
  'videoScript',
];

/** Narrow an arbitrary string to an editable artifact key. */
export function isEditableArtifactKey(value: string): value is EditableArtifactKey {
  return (EDITABLE_ARTIFACT_KEYS as readonly string[]).includes(value);
}

/** A single, undoable previous version of an edited artifact. */
export interface ArtifactVersion {
  artifactKey: EditableArtifactKey;
  previousValue: EditableArtifact;
  updatedAt: Date;
  changeSummary: string;
}

interface UiSessionRecord {
  result: AnalysisResult;
  artifactHistory: ArtifactVersion[];
}

/** Read the editable artifact for a key, or undefined when not generated. */
export function getEditableArtifact(
  result: AnalysisResult,
  key: EditableArtifactKey,
): EditableArtifact | undefined {
  switch (key) {
    case 'prDescription':
      return result.prDescription;
    case 'videoScript':
      return result.videoScript;
    case 'dailyUpdate':
      return result.dailyUpdate;
    default: {
      const exhaustive: never = key;
      return exhaustive;
    }
  }
}

function setEditableArtifact(
  result: AnalysisResult,
  key: EditableArtifactKey,
  value: EditableArtifact,
): void {
  switch (key) {
    case 'prDescription':
      result.prDescription = value as PRDescription;
      return;
    case 'videoScript':
      result.videoScript = value as VideoScript;
      return;
    case 'dailyUpdate':
      result.dailyUpdate = value as DailyUpdate;
      return;
    default: {
      const exhaustive: never = key;
      throw new Error(`Unsupported artifact key: ${String(exhaustive)}`);
    }
  }
}

export class UiSessionStore {
  private readonly sessions = new Map<string, UiSessionRecord>();

  /**
   * Cache a result for a session. Existing undo history is preserved across
   * on-demand generation re-runs (the result is refreshed, history is kept).
   */
  saveResult(result: AnalysisResult): void {
    const existing = this.sessions.get(result.sessionId);
    this.sessions.set(result.sessionId, {
      result: structuredClone(result),
      artifactHistory: existing === undefined ? [] : existing.artifactHistory,
    });
  }

  /** Return a clone of the cached result, or undefined if the session is unknown. */
  getResult(sessionId: string): AnalysisResult | undefined {
    const record = this.sessions.get(sessionId);
    return record === undefined ? undefined : structuredClone(record.result);
  }

  /** Whether an undoable previous version exists for the given artifact. */
  hasHistory(sessionId: string, artifactKey: EditableArtifactKey): boolean {
    const record = this.sessions.get(sessionId);
    if (record === undefined) return false;
    return record.artifactHistory.some((v) => v.artifactKey === artifactKey);
  }

  /**
   * Store the previous version of the selected artifact, then replace ONLY that
   * artifact with the updated value. No other artifact is touched. Returns a
   * clone of the updated result.
   */
  applyEdit({
    sessionId,
    artifactKey,
    updatedArtifact,
    changeSummary,
  }: {
    sessionId: string;
    artifactKey: EditableArtifactKey;
    updatedArtifact: EditableArtifact;
    changeSummary: string;
  }): AnalysisResult {
    const record = this.sessions.get(sessionId);
    if (record === undefined) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    const previousValue = getEditableArtifact(record.result, artifactKey);
    if (previousValue === undefined) {
      throw new Error(`Artifact "${artifactKey}" is not present in session ${sessionId}.`);
    }
    record.artifactHistory.push({
      artifactKey,
      previousValue: structuredClone(previousValue),
      updatedAt: new Date(),
      changeSummary,
    });
    setEditableArtifact(record.result, artifactKey, structuredClone(updatedArtifact));
    return structuredClone(record.result);
  }

  /**
   * Replace the session's Daily Work Guidance with a decision-updated version
   * (the approval loop's state transition). Not part of the chat-edit history:
   * decisions are deliberate state changes, not undoable text edits. Returns a
   * clone of the updated result.
   */
  updateDailyWorkGuidance({
    sessionId,
    guidance,
  }: {
    sessionId: string;
    guidance: DailyWorkGuidance;
  }): AnalysisResult {
    const record = this.sessions.get(sessionId);
    if (record === undefined) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    if (record.result.dailyWorkGuidance === undefined) {
      throw new Error(`Daily Work Guidance is not present in session ${sessionId}.`);
    }
    record.result.dailyWorkGuidance = structuredClone(guidance);
    return structuredClone(record.result);
  }

  /**
   * Restore the most recent previous version for the selected artifact and
   * consume that history entry. Only the selected artifact is affected. Returns
   * the updated result and whether anything was restored.
   */
  undoEdit(
    sessionId: string,
    artifactKey: EditableArtifactKey,
  ): { result: AnalysisResult; restored: boolean } {
    const record = this.sessions.get(sessionId);
    if (record === undefined) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    for (let i = record.artifactHistory.length - 1; i >= 0; i--) {
      const entry = record.artifactHistory[i];
      if (entry !== undefined && entry.artifactKey === artifactKey) {
        setEditableArtifact(record.result, artifactKey, structuredClone(entry.previousValue));
        record.artifactHistory.splice(i, 1);
        return { result: structuredClone(record.result), restored: true };
      }
    }
    return { result: structuredClone(record.result), restored: false };
  }
}
