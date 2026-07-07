import { randomUUID } from 'node:crypto';
import type {
  ChangeUnderstanding,
  OutputKey,
  SessionInputs,
  SessionPhase,
  SessionState,
} from '../types/index.js';

/**
 * In-memory owner of a single SessionState (V1: no persistence, no repository,
 * no external storage).
 *
 * The store holds the two memory layers (Understanding Memory + Output Memory)
 * and exposes small, intention-revealing mutators. It performs no reasoning and
 * no workflow logic — that belongs to the Harness.
 */
export class SessionStore {
  private state: SessionState;

  constructor(inputs: SessionInputs) {
    const now = new Date().toISOString();
    this.state = {
      id: randomUUID(),
      phase: 'created',
      createdAt: now,
      updatedAt: now,
      inputs: { requirement: inputs.requirement, diff: inputs.diff },
      outputs: {},
    };
  }

  get phase(): SessionPhase {
    return this.state.phase;
  }

  get inputs(): SessionInputs {
    return { ...this.state.inputs };
  }

  /** Understanding Memory accessor. */
  get understanding(): ChangeUnderstanding | undefined {
    return this.state.understanding;
  }

  /** Output Memory read for a specific key. */
  getOutput(key: OutputKey): string | undefined {
    return this.state.outputs[key];
  }

  setPhase(phase: SessionPhase): void {
    this.state.phase = phase;
    this.touch();
  }

  /** Write Understanding Memory. */
  setUnderstanding(understanding: ChangeUnderstanding): void {
    this.state.understanding = understanding;
    this.touch();
  }

  /** Write a single Output Memory entry. */
  setOutput({ key, value }: { key: OutputKey; value: string }): void {
    this.state.outputs[key] = value;
    this.touch();
  }

  /**
   * Returns a deep, immutable snapshot so callers can inspect state without
   * mutating the store's internals.
   */
  snapshot(): SessionState {
    return structuredClone(this.state);
  }

  private touch(): void {
    this.state.updatedAt = new Date().toISOString();
  }
}
