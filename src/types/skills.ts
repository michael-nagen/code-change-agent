/**
 * Skill / generator contracts.
 *
 * Skills are where all business reasoning lives (mocked in V1). The Harness
 * depends only on these interfaces, never on concrete implementations, so real
 * LLM-backed skills can be swapped in later with zero Harness changes.
 */
import type { ChangeUnderstanding, SessionOutputs } from './session.js';

/**
 * Input to the change-understanding step.
 */
export interface ChangeUnderstandingInput {
  requirement: string;
  diff: string;
}

/**
 * Produces structured Understanding Memory from raw inputs.
 */
export interface ChangeUnderstandingSkill {
  readonly name: string;
  execute(input: ChangeUnderstandingInput): Promise<ChangeUnderstanding>;
}

/**
 * Any key in Output Memory that a generator can write to.
 */
export type OutputKey = keyof SessionOutputs;

/**
 * A generator turns Understanding Memory into a single output artifact.
 *
 * This is the extension seam: adding a new output (PR description, video
 * script, flow, presentation, ...) means implementing one OutputGenerator and
 * registering it. The Harness treats them uniformly.
 */
export interface OutputGenerator {
  /** Human-readable name, for logging/debugging. */
  readonly name: string;
  /** The Output Memory key this generator writes to. */
  readonly outputKey: OutputKey;
  execute(input: ChangeUnderstanding): Promise<string>;
}

/**
 * The report generator is just an OutputGenerator pinned to the V1 report key.
 * Kept as a named type for clarity at the API surface.
 */
export interface ReportGenerationSkill extends OutputGenerator {
  readonly outputKey: 'codeUnderstandingReport';
}

/**
 * The set of skills the Harness is wired with.
 *
 * `generators` is a list so future outputs are added by appending, not by
 * editing the Harness.
 */
export interface HarnessSkills {
  changeUnderstanding: ChangeUnderstandingSkill;
  generators: OutputGenerator[];
}
