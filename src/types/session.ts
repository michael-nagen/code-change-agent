/**
 * Session-related types.
 *
 * These describe the *shape* of a session and its two memory layers.
 * They contain no behavior and no business reasoning.
 */

/**
 * Lifecycle phases a session moves through, in order.
 * The Harness uses these to enforce that workflow steps run in sequence.
 */
export type SessionPhase = 'created' | 'started' | 'understood' | 'reported';

/**
 * Raw inputs provided when a session starts.
 */
export interface SessionInputs {
  requirement: string;
  diff: string;
}

/**
 * Understanding Memory.
 *
 * The structured understanding of the change, produced by the
 * ChangeUnderstandingSkill. This is knowledge, not an output artifact.
 */
export interface ChangeUnderstanding {
  requirementSummary: string;
  whatChanged: string[];
  keyFunctionality: string;
  goalAlignment: string;
  mainComponents: string[];
}

/**
 * Output Memory.
 *
 * Generated, user-facing artifacts. V1 only produces the code understanding
 * report. Future generators add their own keys here (PR description, video
 * script, flow, presentation, ...) without requiring Harness changes.
 */
export interface SessionOutputs {
  codeUnderstandingReport?: string;
}

/**
 * The single, central session state object owned by the Harness.
 */
export interface SessionState {
  id: string;
  phase: SessionPhase;
  createdAt: string;
  updatedAt: string;
  inputs: SessionInputs;
  /** Understanding Memory (populated by buildUnderstanding). */
  understanding?: ChangeUnderstanding;
  /** Output Memory (populated by generators). */
  outputs: SessionOutputs;
}
