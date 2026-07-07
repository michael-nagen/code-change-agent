import type {
  ChangeUnderstanding,
  HarnessSkills,
  OutputGenerator,
  OutputKey,
  SessionInputs,
  SessionPhase,
  SessionState,
} from '../types/index.js';
import { HarnessError } from '../errors/HarnessError.js';
import { validateInputs } from '../validation/validateInputs.js';
import {
  MockChangeUnderstandingSkill,
  MockReportGenerationSkill,
} from '../skills/mocks/index.js';
import { SessionStore } from './SessionStore.js';

/** Options shared by guarded steps. */
export interface StepOptions {
  /** Re-run the step even if its result already exists in memory. */
  force?: boolean;
}

/** Parameters for generating a specific registered output. */
export interface GenerateParams extends StepOptions {
  key: OutputKey;
}

/** Total ordering of phases, used to guard step sequencing. */
const PHASE_ORDER: Record<SessionPhase, number> = {
  created: 0,
  started: 1,
  understood: 2,
  reported: 3,
};

/**
 * The Harness: a pure orchestration layer.
 *
 * Responsibilities:
 *  - lifecycle (phase sequencing)
 *  - session state + two memory layers (via SessionStore)
 *  - workflow execution (delegating all reasoning to skills)
 *  - recomputation avoidance (memory-first, `force` to override)
 *
 * It contains no business reasoning. Reasoning lives in skills/generators.
 */
export class CodeUnderstandingHarness {
  private readonly changeUnderstanding: HarnessSkills['changeUnderstanding'];
  private readonly generators: Map<OutputKey, OutputGenerator>;
  private store?: SessionStore;

  constructor(skills?: Partial<HarnessSkills>) {
    this.changeUnderstanding =
      skills?.changeUnderstanding ?? new MockChangeUnderstandingSkill();

    const generators = skills?.generators ?? [new MockReportGenerationSkill()];
    this.generators = new Map(generators.map((g) => [g.outputKey, g]));
  }

  /**
   * Register an additional output generator after construction.
   * This is the extension seam for future outputs (PR description, video
   * script, flow, presentation, ...).
   */
  registerGenerator(generator: OutputGenerator): void {
    this.generators.set(generator.outputKey, generator);
  }

  /** Intake + create session. created -> started. */
  async start(inputs: SessionInputs): Promise<void> {
    validateInputs(inputs);
    this.store = new SessionStore(inputs);
    this.store.setPhase('started');
  }

  /** Produce Understanding Memory. started -> understood. */
  async buildUnderstanding(options: StepOptions = {}): Promise<ChangeUnderstanding> {
    const store = this.requireStore();
    this.requirePhaseAtLeast({ min: 'started', step: 'buildUnderstanding' });

    const existing = store.understanding;
    if (existing && !options.force) {
      return existing;
    }

    const understanding = await this.changeUnderstanding.execute(store.inputs);
    store.setUnderstanding(understanding);
    this.advancePhase('understood');
    return understanding;
  }

  /** Convenience: generate the V1 Code Understanding Report. */
  async generateReport(options: StepOptions = {}): Promise<string> {
    return this.generate({ key: 'codeUnderstandingReport', ...options });
  }

  /**
   * Generate any registered output from Understanding Memory.
   * understood -> reported (on first successful generation).
   */
  async generate({ key, force }: GenerateParams): Promise<string> {
    const store = this.requireStore();
    this.requirePhaseAtLeast({ min: 'understood', step: `generate(${key})` });

    const cached = store.getOutput(key);
    if (cached !== undefined && !force) {
      return cached;
    }

    const generator = this.generators.get(key);
    if (!generator) {
      throw new HarnessError('UNKNOWN_GENERATOR', `No generator registered for output "${key}".`);
    }

    const understanding = store.understanding;
    if (!understanding) {
      throw new HarnessError('INVALID_PHASE', 'Understanding Memory is empty.');
    }

    const output = await generator.execute(understanding);
    store.setOutput({ key, value: output });
    this.advancePhase('reported');
    return output;
  }

  /**
   * Convenience pipeline: start -> buildUnderstanding -> generateReport.
   * No additional logic.
   */
  async run(inputs: SessionInputs): Promise<string> {
    await this.start(inputs);
    await this.buildUnderstanding();
    return this.generateReport();
  }

  /** Immutable snapshot of the central session state. */
  getState(): SessionState {
    return this.requireStore().snapshot();
  }

  // --- internal guards ---

  private requireStore(): SessionStore {
    if (!this.store) {
      throw new HarnessError('INVALID_PHASE', 'Session not started. Call start() first.');
    }
    return this.store;
  }

  private requirePhaseAtLeast({ min, step }: { min: SessionPhase; step: string }): void {
    const current = this.requireStore().phase;
    if (PHASE_ORDER[current] < PHASE_ORDER[min]) {
      throw new HarnessError(
        'INVALID_PHASE',
        `Cannot run "${step}" in phase "${current}"; requires at least "${min}".`,
      );
    }
  }

  /** Only move phase forward, never backward (idempotent re-runs are safe). */
  private advancePhase(target: SessionPhase): void {
    const store = this.requireStore();
    if (PHASE_ORDER[store.phase] < PHASE_ORDER[target]) {
      store.setPhase(target);
    }
  }
}
