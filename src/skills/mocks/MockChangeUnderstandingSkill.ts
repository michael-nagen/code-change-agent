import type {
  ChangeUnderstanding,
  ChangeUnderstandingInput,
  ChangeUnderstandingSkill,
} from '../../types/index.js';

/**
 * Mock skill. Returns fake, deterministic data — its only job is to validate
 * the architecture and workflow, not to reason about the change.
 *
 * A real implementation (LLM-backed) would replace this while keeping the same
 * interface.
 */
export class MockChangeUnderstandingSkill implements ChangeUnderstandingSkill {
  readonly name = 'mock-change-understanding';

  async execute(input: ChangeUnderstandingInput): Promise<ChangeUnderstanding> {
    return {
      requirementSummary: `Mock summary of requirement (${input.requirement.length} chars).`,
      whatChanged: ['Mock change A', 'Mock change B'],
      keyFunctionality: 'Mock key functionality derived from the diff.',
      goalAlignment: 'Mock: the change appears aligned with the requirement.',
      mainComponents: ['MockComponentOne', 'MockComponentTwo'],
    };
  }
}
