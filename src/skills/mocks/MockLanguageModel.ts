import type { LanguageModel, LanguageModelOutput } from '../../llm/LanguageModel.js';

/**
 * Its sole purpose is to validate the prompt-build → generate → parse →
 * validate pipeline without requiring a real LLM or API key. The response
 * is representative in shape and style but not derived from the actual input.
 */
export class MockLanguageModel implements LanguageModel {
  readonly name = 'mock-language-model';

  async generate(): Promise<LanguageModelOutput> {
    return {
      text: JSON.stringify({
        changeStory:
          'Previously the system executed work directly without a prior reasoning stage. ' +
          'This change introduces a planning step before execution, separating the decision of ' +
          'what to do from the act of doing it. The implementation adds planning state management ' +
          'and updates execution to consume the generated plan.',
        keyFunctionalities: [
          'Supports planning before execution',
          'Generates a structured plan from inputs',
          'Stores the plan as intermediate state',
          'Execution consumes the pre-built plan rather than raw inputs',
        ],
        flow: [
          'Input received',
          'Planning stage executed',
          'Plan stored in memory',
          'Execution consumes plan',
          'Result returned',
        ],
        mainComponents: [
          {
            name: 'MockPlannerComponent',
            responsibility:
              'Responsible for generating a structured execution plan from the provided inputs.',
          },
          {
            name: 'MockExecutorComponent',
            responsibility: 'Responsible for executing work based on the generated plan.',
          },
          {
            name: 'MockPlanStore',
            responsibility:
              'Responsible for holding intermediate plan state between the planning and execution stages.',
          },
        ],
        architecturalDecisions: [
          'Planning separated from execution to allow reasoning before action',
          'Plan stored as intermediate state to support reuse and inspection',
          'Executor decoupled from raw inputs — it reads only from the plan',
        ],
        impactAnalysis: [
          'Execution flow is affected: it now depends on a prior planning stage',
          'Planner component is newly introduced',
          'Plan state management is newly introduced',
          'Existing output interfaces and session lifecycle are not affected',
        ],
        uncertainties: [
          'Whether this change is already active in production',
          'Whether existing tests were updated to cover the new planning stage',
          'Whether other components depend on the planner output beyond the executor',
          'Whether the planning stage introduces latency that affects upstream SLAs',
        ],
      }),
    };
  }
}
