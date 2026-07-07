/**
 * Standalone example for the RequirementAlignmentSkill.
 *
 * Run with: npm run example:requirement-alignment
 *
 * Demonstrates:
 *   requirementText + changeExplanation + optional rawDiff
 *   → RequirementAlignmentSkill (with a deterministic mock model)
 *   → RequirementAlignment
 *
 * No Harness, no git operations, no output generators.
 */
import type { LanguageModel, LanguageModelOutput } from '../src/index.js';
import {
  DefaultRequirementAlignmentSkill,
} from '../src/index.js';
import type { ChangeExplanation } from '../src/index.js';

// ---------------------------------------------------------------------------
// Mock model — returns a deterministic RequirementAlignment JSON response.
// Swapped out for a real LLM adapter in production; the skill does not care.
// ---------------------------------------------------------------------------
class MockRequirementAlignmentModel implements LanguageModel {
  readonly name = 'mock-requirement-alignment-model';

  async generate(): Promise<LanguageModelOutput> {
    return {
      text: JSON.stringify({
        requirementSummary:
          'Introduce a planning stage that separates the decision of what to do from ' +
          'the act of doing it, storing the plan as intermediate state before execution.',
        satisfiedItems: [
          'A dedicated planning stage before execution is implemented, as evidenced by the ' +
            '"Supports planning before execution" key functionality.',
          'The plan is stored as intermediate state between planning and execution, ' +
            'as described by the MockPlanStore component.',
          'Execution is decoupled from raw inputs and reads only from the pre-built plan, ' +
            'consistent with the stated architectural decision.',
          'The planning and execution stages are architecturally separated, with the planner ' +
            'and executor as distinct components.',
        ],
        partiallySatisfiedItems: [
          'The requirement asks for the plan to be "inspectable" — the PlanStore is present ' +
            'but no inspection or querying interface is described in the Change Explanation.',
        ],
        missingItems: [],
        unclearItems: [
          'Whether the planning stage is activated for all execution paths or only specific ones.',
          'Whether the plan schema is stable enough for downstream consumers to depend on.',
        ],
        overallAssessment:
          'The change appears to satisfy the core requirement: a planning stage now exists, ' +
          'it is separated from execution, and the plan is held in intermediate state. ' +
          'One partial gap exists around plan inspectability. ' +
          'Overall confidence is high because the Change Explanation describes all major ' +
          'structural decisions with sufficient clarity.',
        confidence: 'high',
      }),
    };
  }
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

const requirementText = `
Add a planning stage before execution.

The system currently executes work immediately when inputs are received.
We need to separate the decision of what to do from the act of doing it.

Specifically:
- Introduce a planner that generates a structured plan from the inputs.
- Store the plan as intermediate state.
- The executor must consume the plan, not the raw inputs.
- The plan should be inspectable after planning and before execution.
`.trim();

// Reuse the same ChangeExplanation shape that MockLanguageModel produces in
// the change-explanation example, so inputs are consistent and realistic.
const changeExplanation: ChangeExplanation = {
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
};

// Optional: include a raw diff to demonstrate fallback context.
// The skill receives it but the mock model ignores it (a real model would
// consult it only when the ChangeExplanation leaves genuine uncertainty).
const rawDiff = `diff --git a/src/Planner.ts b/src/Planner.ts
new file mode 100644
--- /dev/null
+++ b/src/Planner.ts
@@ -0,0 +1,10 @@
+export class Planner {
+  plan(inputs: unknown): Plan {
+    return { steps: [], inputs };
+  }
+}`;

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const model = new MockRequirementAlignmentModel();
  const skill = new DefaultRequirementAlignmentSkill(model);

  console.log('Skill:', skill.name);
  console.log('Model:', model.name);
  console.log('Raw diff provided: yes (optional fallback)');
  console.log();

  const alignment = await skill.execute({ requirementText, changeExplanation, rawDiff });

  console.log('=== Requirement Summary ===');
  console.log(alignment.requirementSummary);

  console.log('\n=== Satisfied Items ===');
  for (const item of alignment.satisfiedItems) {
    console.log(' ✓', item);
  }

  if (alignment.partiallySatisfiedItems.length > 0) {
    console.log('\n=== Partially Satisfied Items ===');
    for (const item of alignment.partiallySatisfiedItems) {
      console.log(' ~', item);
    }
  }

  if (alignment.missingItems.length > 0) {
    console.log('\n=== Missing Items ===');
    for (const item of alignment.missingItems) {
      console.log(' ✗', item);
    }
  }

  if (alignment.unclearItems.length > 0) {
    console.log('\n=== Unclear Items ===');
    for (const item of alignment.unclearItems) {
      console.log(' ?', item);
    }
  }

  console.log('\n=== Overall Assessment ===');
  console.log(alignment.overallAssessment);

  console.log('\n=== Confidence ===');
  console.log(alignment.confidence);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
