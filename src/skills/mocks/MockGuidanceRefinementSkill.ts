import type {
  GuidancePlanRefinement,
  GuidanceRefinementInput,
  GuidanceRefinementSkill,
} from '../dailyWorkGuidanceRefinement/index.js';

const MOCK_TAG = '[DEMO/MOCK OUTPUT — not real AI]';

/**
 * Deterministic stand-in for the refinement skill so the mock UI exercises the
 * full re-planning loop without a model. For every rejected/edited step it
 * proposes one clearly-tagged revised step that quotes the user's reason, and
 * refreshes the Notion/memory prose. All output is visibly mock.
 */
export class MockGuidanceRefinementSkill implements GuidanceRefinementSkill {
  readonly name = 'mock-guidance-refinement';

  async execute(input: GuidanceRefinementInput): Promise<GuidancePlanRefinement> {
    const feedback = input.decisions.filter(
      (decision) => decision.action === 'reject' || decision.action === 'edit',
    );
    const revisedSteps = feedback.map((decision) => {
      const basis = decision.editedText ?? decision.note ?? decision.itemId;
      return {
        respondsTo: decision.itemId,
        title: `${MOCK_TAG} Revised: ${basis}`,
        whyItMatters: `${MOCK_TAG} Reworked from your feedback${decision.note !== undefined ? `: ${decision.note}` : '.'}`,
        expectedOutput: `${MOCK_TAG} Demo revised output.`,
        cursorPrompt: `${MOCK_TAG} Demo revised prompt — do not run against real code.`,
        validationChecklist: [`${MOCK_TAG} Demo validation.`],
        status: 'pending_approval' as const,
      };
    });

    return {
      revisionSummary: `${MOCK_TAG} Revised ${revisedSteps.length} step${revisedSteps.length === 1 ? '' : 's'} based on your feedback.`,
      revisedSteps,
      notionDailyUpdate: {
        ...input.guidance.notionDailyUpdate,
        progressVsSpec: `${MOCK_TAG} Plan revised after your feedback.`,
      },
      memoryUpdate: {
        ...input.guidance.memoryUpdate,
        dailySummary: `${MOCK_TAG} Plan revised after user feedback.`,
      },
    };
  }
}
