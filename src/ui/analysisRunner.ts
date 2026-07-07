/**
 * Runners that produce an `AnalysisResult` for the UI.
 *
 * - `HarnessAnalysisRunner` wraps the real, official V2 `AnalysisHarness`. It is
 *   the seam through which the real AI-backed engine is connected; this file
 *   does NOT construct or modify any AI provider.
 * - `MockAnalysisRunner` returns deterministic, clearly-labeled DEMO output so
 *   the UI shell can be exercised without a live model. Its text is explicitly
 *   marked as mock so it can never be mistaken for real AI output.
 */
import type { AnalysisHarness, AnalysisResult } from '../analysis/index.js';
import type { AnalysisRequest, AnalysisRunner } from './types.js';

const MOCK_TAG = '[DEMO/MOCK OUTPUT — not real AI]';

/**
 * Wraps the official `AnalysisHarness`. The harness is injected fully
 * constructed (with its own `model`), keeping provider wiring out of the UI.
 */
export class HarnessAnalysisRunner implements AnalysisRunner {
  readonly name = 'analysis-harness';
  private readonly harness: AnalysisHarness;

  constructor(harness: AnalysisHarness) {
    this.harness = harness;
  }

  async run(request: AnalysisRequest): Promise<AnalysisResult> {
    // `projectName` is display-only in v0 (no persistence). It is deliberately
    // NOT forwarded as `projectId`: the harness requires a project that already
    // exists in its store, so passing an arbitrary name would fail the run.
    //
    // `sessionId` (when present) drives on-demand generation: the harness reuses
    // artifacts already on the session and only runs the newly-requested skills.
    return this.harness.runAnalysis({
      rawDiff: request.rawDiff,
      requirementText: request.requirementText,
      includeFlow: request.includeFlow,
      includeGapReport: request.includeGapReport,
      includePrDescription: request.includePrDescription,
      includeVideoScript: request.includeVideoScript,
      includeDailyUpdate: request.includeDailyUpdate,
      ...(request.sessionId !== undefined ? { sessionId: request.sessionId } : {}),
    });
  }
}

/**
 * Deterministic demo runner. Honors the include flags exactly like the real
 * workflow (so the "Not generated" vs present behavior is exercised) but never
 * calls a model. All free-text fields are prefixed with a visible MOCK tag.
 */
export class MockAnalysisRunner implements AnalysisRunner {
  readonly name = 'mock-demo';

  async run(request: AnalysisRequest): Promise<AnalysisResult> {
    if (request.requirementText.trim() === '') {
      throw new Error('requirementText must not be empty.');
    }
    if (request.rawDiff.trim() === '') {
      throw new Error('rawDiff must not be empty.');
    }
    // Mirror the harness dependency rule so the demo behaves like the engine.
    if (request.includePrDescription && (!request.includeFlow || !request.includeGapReport)) {
      throw new Error('includePrDescription requires includeFlow, includeGapReport to be enabled.');
    }
    if (request.includeVideoScript && (!request.includeFlow || !request.includeGapReport)) {
      throw new Error('includeVideoScript requires includeFlow, includeGapReport to be enabled.');
    }
    if (
      request.includeDailyUpdate &&
      (!request.includeFlow || !request.includeGapReport || !request.includePrDescription)
    ) {
      throw new Error(
        'includeDailyUpdate requires includeFlow, includeGapReport, includePrDescription to be enabled.',
      );
    }

    const result: AnalysisResult = {
      // Echo a provided sessionId so the UI's on-demand generation keeps a
      // stable session across follow-up calls (matching the real harness).
      sessionId: request.sessionId ?? 'mock-session-0001',
      requirementInput: {
        requirementText: request.requirementText,
        source: 'manual',
      },
      changeExplanation: {
        changeStory: `${MOCK_TAG} This change introduces the described capability based on the supplied diff.`,
        keyFunctionalities: [`${MOCK_TAG} Adds the primary capability described in the requirement.`],
        flow: ['Receive input', 'Process change', 'Return result'],
        mainComponents: [
          { name: 'MockComponent', responsibility: `${MOCK_TAG} Demo component responsibility.` },
        ],
        architecturalDecisions: [`${MOCK_TAG} Demo architectural decision.`],
        impactAnalysis: [`${MOCK_TAG} Demo impact analysis.`],
        uncertainties: [`${MOCK_TAG} This is demo data, not a real analysis.`],
      },
      requirementAlignment: {
        requirementSummary: `${MOCK_TAG} ${request.requirementText.slice(0, 80)}`,
        satisfiedItems: [`${MOCK_TAG} Demo satisfied item.`],
        partiallySatisfiedItems: [],
        missingItems: [],
        unclearItems: [`${MOCK_TAG} Cannot verify — demo data.`],
        overallAssessment: `${MOCK_TAG} Demo overall assessment.`,
        confidence: 'low',
      },
    };

    if (request.includeFlow) {
      result.flowArtifact = {
        title: `${MOCK_TAG} Feature flow`,
        description: `${MOCK_TAG} Demo flow description.`,
        steps: ['Start', 'Do work', 'Finish'],
        mermaid: 'flowchart TD\n  A[Start] --> B[Do work] --> C[Finish]',
      };
    }
    if (request.includeGapReport) {
      result.gapReport = {
        readiness: 'unclear',
        completedWork: [`${MOCK_TAG} Demo completed work.`],
        remainingGaps: [`${MOCK_TAG} Demo remaining gap.`],
        partialItems: [],
        unclearItems: [`${MOCK_TAG} Demo unclear item.`],
        risks: [`${MOCK_TAG} Demo risk.`],
        recommendedNextActions: [`${MOCK_TAG} Replace mock runner with real engine.`],
        prRecommendation: `${MOCK_TAG} Demo recommendation — do not treat as real.`,
      };
    }
    if (request.includePrDescription) {
      result.prDescription = {
        title: `${MOCK_TAG} PR title`,
        summary: `${MOCK_TAG} Demo PR summary.`,
        whatChanged: [`${MOCK_TAG} Demo capability.`],
        requirementCoverage: [`${MOCK_TAG} Demo coverage line.`],
        featureFlow: `${MOCK_TAG} Demo feature flow prose.`,
        testingNotes: [`${MOCK_TAG} Demo testing note.`],
        risksAndFollowUps: [`${MOCK_TAG} Demo follow-up.`],
      };
    }
    if (request.includeVideoScript) {
      result.videoScript = {
        title: `${MOCK_TAG} Walkthrough`,
        targetAudience: 'Developers',
        estimatedDuration: '~1 minute',
        sections: [
          {
            title: 'Intro',
            narration: `${MOCK_TAG} Demo narration.`,
            visualCue: 'Show the diff',
          },
        ],
        keyTakeaways: [`${MOCK_TAG} Demo takeaway.`],
      };
    }
    if (request.includeDailyUpdate) {
      result.dailyUpdate = {
        headline: `${MOCK_TAG} Demo headline.`,
        yesterdaySummary: [`${MOCK_TAG} Demo yesterday item.`],
        todaySuggestions: [`${MOCK_TAG} Demo today item.`],
        blockersOrRisks: [`${MOCK_TAG} Demo blocker.`],
        highlightedTopic: {
          title: `${MOCK_TAG} Demo topic`,
          explanation: `${MOCK_TAG} Demo explanation.`,
          whyItMatters: `${MOCK_TAG} Demo importance.`,
        },
        spokenVersion: `${MOCK_TAG} Demo spoken update.`,
      };
    }

    return result;
  }
}
