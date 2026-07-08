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
import { buildNormalizedProjectContext } from '../sources/index.js';
import { newTraceId } from '../observability/index.js';
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
    // `projectName` is display-only. `projectId` (when present) is the stable
    // memory key derived from it: the harness uses it to load durable developer
    // memory and only attaches to a registered project if one exists, so an
    // unregistered memory key is safe.
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
      includeDailyWorkGuidance: request.includeDailyWorkGuidance,
      includeTechnicalChangeBrief: request.includeTechnicalChangeBrief,
      includeDemoPrepLoop: request.includeDemoPrepLoop,
      includeWeeklyReview: request.includeWeeklyReview,
      ...(request.userId !== undefined ? { userId: request.userId } : {}),
      ...(request.projectId !== undefined ? { projectId: request.projectId } : {}),
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
    if (request.includeDailyWorkGuidance && (!request.includeFlow || !request.includeGapReport)) {
      throw new Error(
        'includeDailyWorkGuidance requires includeFlow, includeGapReport to be enabled.',
      );
    }
    // The technical change brief depends only on the required base analysis, so
    // it imposes no additional include-flag prerequisites.

    const result: AnalysisResult = {
      // Echo a provided sessionId so the UI's on-demand generation keeps a
      // stable session across follow-up calls (matching the real harness).
      sessionId: request.sessionId ?? 'mock-session-0001',
      // A trace id so the demo UI shows one even in mock mode. The real harness
      // emits full structured logs under its own per-run trace id.
      traceId: newTraceId(),
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

    // Demo-only normalized project context so the Sources panel shows the full
    // range of source kinds (manual spec/diff, memory, GitHub, Notion). These
    // GitHub/Notion entries are SAMPLE data — nothing was actually fetched from
    // any connector in mock mode. They are built by the same deterministic
    // builder the real engine uses, drive no reasoning, and are clearly labelled
    // so the UI never implies a real fetch happened.
    const now = new Date().toISOString();
    result.projectContext = buildNormalizedProjectContext({
      manualRequirementText: request.requirementText,
      manualDiffText: request.rawDiff,
      memoryContext: {
        userId: request.userId ?? 'local',
        notes: [],
        previousProgressMemory: `${MOCK_TAG} Prior progress carried in from the last run.`,
      },
      externalSources: [
        {
          source: {
            kind: 'github',
            title: `${MOCK_TAG} Sample pull request #42 (not fetched)`,
            url: 'https://github.com/demo/repo/pull/42',
            fetchedAt: now,
            confidence: 'inferred',
          },
          text: `${MOCK_TAG} Sample pull request description and combined diff — not actually fetched from GitHub.`,
          summary: `${MOCK_TAG} Sample GitHub pull request — mock data, not actually fetched.`,
        },
        {
          source: {
            kind: 'notion',
            title: `${MOCK_TAG} Sample spec page (not fetched)`,
            url: 'https://www.notion.so/demo-spec',
            fetchedAt: now,
            confidence: 'inferred',
          },
          text: `${MOCK_TAG} Sample Notion spec content — not actually fetched from Notion.`,
          summary: `${MOCK_TAG} Sample Notion spec page — mock data, not actually fetched.`,
        },
      ],
      now,
    });

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
    if (request.includeDailyWorkGuidance) {
      const date = new Date().toISOString().slice(0, 10);
      result.dailyWorkGuidance = {
        loopStatus: { currentStage: 'planning', overallStatus: 'pending_user_review' },
        selfCritique: {
          issues: [
            {
              targetStepId: 'step-1',
              issue: `${MOCK_TAG} Demo issue: the step had no validation check.`,
              severity: 'medium',
              suggestion: `${MOCK_TAG} Demo suggestion: add a concrete validation step.`,
            },
          ],
          revisionApplied: true,
          summary: `${MOCK_TAG} Demo self-review: revised the plan once before showing it.`,
          confidence: 'medium',
          checkedAt: new Date().toISOString(),
        },
        yesterdaySummary: `${MOCK_TAG} Demo summary of yesterday's work.`,
        progressVsSpec: [
          {
            item: `${MOCK_TAG} Demo checklist item.`,
            whatChanged: `${MOCK_TAG} Demo change.`,
            newStatus: 'unclear',
            evidence: `${MOCK_TAG} Demo evidence.`,
            confidence: 'low',
          },
        ],
        advancedChecklistItems: [],
        blockersAndRisks: [
          {
            title: `${MOCK_TAG} Demo blocker.`,
            description: `${MOCK_TAG} Demo description.`,
            whyItMatters: `${MOCK_TAG} Demo impact.`,
            requiredAction: `${MOCK_TAG} Replace mock runner with real engine.`,
          },
        ],
        decisionsNeedingApproval: [
          {
            decision: `${MOCK_TAG} Demo decision.`,
            context: `${MOCK_TAG} Demo context.`,
            status: 'pending_approval',
          },
        ],
        plannedSteps: [
          {
            id: 'step-1',
            title: `${MOCK_TAG} Demo step.`,
            whyItMatters: `${MOCK_TAG} Demo rationale.`,
            expectedOutput: `${MOCK_TAG} Demo output.`,
            cursorPrompt: `${MOCK_TAG} Demo prompt — do not run against real code.`,
            validationChecklist: [`${MOCK_TAG} Demo validation.`],
            status: 'pending_approval',
          },
        ],
        notionDailyUpdate: {
          yesterday: `${MOCK_TAG} Demo yesterday.`,
          today: `${MOCK_TAG} Demo today.`,
          blockers: `${MOCK_TAG} Demo blockers.`,
          decisionsNeeded: `${MOCK_TAG} Demo decisions.`,
          progressVsSpec: `${MOCK_TAG} Demo progress summary.`,
          nextCursorPrompt: `${MOCK_TAG} Demo next prompt.`,
        },
        memoryUpdate: {
          date,
          dailySummary: `${MOCK_TAG} Demo daily summary.`,
          updatedChecklistStatuses: [{ item: `${MOCK_TAG} Demo item.`, status: 'unclear' }],
          newDecisions: [`${MOCK_TAG} Demo decision.`],
          openBlockers: [`${MOCK_TAG} Demo blocker.`],
          nextActions: [`${MOCK_TAG} Demo next action.`],
        },
      };
    }
    // The demo prep loop, like the technical change brief, depends only on the
    // required base analysis and imposes no additional flag prerequisites.
    if (request.includeDemoPrepLoop) {
      result.demoPrepLoop = {
        loopStatus: {
          currentStage: `${MOCK_TAG} Initial demo plan proposed.`,
          overallStatus: 'pending_user_review',
          nextRecommendedAction: `${MOCK_TAG} Review the walkthrough order.`,
          whatNeedsUserApproval: [`${MOCK_TAG} Demo story.`],
        },
        demoStoryProposal: {
          problem: `${MOCK_TAG} Demo problem.`,
          solution: `${MOCK_TAG} Demo solution.`,
          technicalChange: `${MOCK_TAG} Demo technical change.`,
          userOrProductValue: `${MOCK_TAG} Demo value.`,
          proofOrDemoMoment: `${MOCK_TAG} Demo proof moment.`,
          limitationsOrNextSteps: `${MOCK_TAG} Demo limitation.`,
          status: 'pending_approval',
        },
        walkthroughOrder: [
          {
            order: 1,
            title: `${MOCK_TAG} Demo walkthrough step`,
            filePath: 'demo/file.ts',
            type: 'code',
            whyThisComesHere: `${MOCK_TAG} Demo rationale.`,
            whatToShow: `${MOCK_TAG} Demo focus.`,
            whatToSay: `${MOCK_TAG} Demo narration.`,
            whatToSkip: `${MOCK_TAG} Demo skip note.`,
            relatedFeatureOrConcept: `${MOCK_TAG} Demo concept.`,
            estimatedTimeSeconds: 45,
            mustShow: true,
            evidence: 'inferred',
            status: 'pending_approval',
          },
        ],
        codeEvidencePlan: [
          {
            filePath: 'demo/file.ts',
            evidenceType: 'workflow',
            whatItProves: `${MOCK_TAG} Demo proof.`,
            whyItMatters: `${MOCK_TAG} Demo importance.`,
            confidence: 'low',
            evidence: 'inferred',
            status: 'pending_approval',
          },
        ],
        screenshotPlan: [
          {
            id: 'shot-1',
            title: `${MOCK_TAG} Demo screenshot`,
            type: 'code',
            filePath: 'demo/file.ts',
            whatToCapture: `${MOCK_TAG} Demo capture note.`,
            whyThisMatters: `${MOCK_TAG} Demo importance.`,
            whatToSay: `${MOCK_TAG} Demo narration.`,
            whatToSkip: `${MOCK_TAG} Demo skip note.`,
            relatedFeatureOrConcept: `${MOCK_TAG} Demo concept.`,
            estimatedTimeSeconds: 30,
            mustShow: true,
            suggestedCaption: `${MOCK_TAG} Demo caption.`,
            evidence: 'inferred',
            status: 'pending_approval',
          },
        ],
        approvalQuestions: [
          {
            question: `${MOCK_TAG} Demo approval question?`,
            whyItMatters: `${MOCK_TAG} Demo stakes.`,
            options: ['Option A', 'Option B'],
            recommendedOption: 'Option A',
            status: 'pending_approval',
          },
        ],
        deckPlan: [
          {
            slideNumber: 1,
            title: `${MOCK_TAG} Demo opening slide`,
            purpose: `${MOCK_TAG} Demo purpose.`,
            visualType: 'bullets',
            whatToShow: `${MOCK_TAG} Demo bullets.`,
            onSlideText: [`${MOCK_TAG} Short bullet`, `${MOCK_TAG} Another bullet`],
            speakerNotes: `${MOCK_TAG} Demo speaker notes.`,
            narrationScript: `${MOCK_TAG} Demo narration script.`,
            transitionToNextSlide: `${MOCK_TAG} Demo transition.`,
            estimatedTimeSeconds: 30,
            mustHave: true,
            status: 'draft',
          },
          {
            slideNumber: 2,
            title: `${MOCK_TAG} Demo evidence slide`,
            purpose: `${MOCK_TAG} Demo purpose.`,
            visualType: 'code_screenshot',
            screenshotIds: ['shot-1'],
            whatToShow: `${MOCK_TAG} Demo screenshot.`,
            onSlideText: [`${MOCK_TAG} Short bullet`],
            speakerNotes: `${MOCK_TAG} Demo speaker notes.`,
            narrationScript: `${MOCK_TAG} Demo narration script.`,
            transitionToNextSlide: `${MOCK_TAG} Demo transition.`,
            estimatedTimeSeconds: 40,
            mustHave: false,
            status: 'draft',
          },
        ],
        draftVideoScript: {
          title: `${MOCK_TAG} Demo video script`,
          estimatedDuration: '5-7 minutes',
          sections: [
            {
              kind: 'opening',
              title: `${MOCK_TAG} Opening`,
              narration: `${MOCK_TAG} Demo narration.`,
              visualCue: `${MOCK_TAG} Demo visual cue.`,
              estimatedTimeSeconds: 30,
            },
            {
              kind: 'implementation_walkthrough',
              title: `${MOCK_TAG} Walkthrough`,
              narration: `${MOCK_TAG} Demo narration.`,
              visualCue: `${MOCK_TAG} Demo visual cue.`,
              estimatedTimeSeconds: 120,
            },
            {
              kind: 'closing',
              title: `${MOCK_TAG} Closing`,
              narration: `${MOCK_TAG} Demo narration.`,
              visualCue: `${MOCK_TAG} Demo visual cue.`,
              estimatedTimeSeconds: 30,
            },
          ],
        },
        finalShortPitch: `${MOCK_TAG} Demo 30-45 second pitch.`,
        readinessChecklist: [
          { item: `${MOCK_TAG} Run tests`, why: `${MOCK_TAG} Demo reason.`, done: false },
          { item: `${MOCK_TAG} Capture screenshots`, why: `${MOCK_TAG} Demo reason.`, done: false },
        ],
      };
    }
    if (request.includeTechnicalChangeBrief) {
      result.technicalChangeBrief = {
        executiveSummary: `${MOCK_TAG} Demo summary of what was built and why.`,
        dataSchemaChanges: {
          hasChanges: false,
          summary: `${MOCK_TAG} No data/schema changes in this demo diff.`,
          newFields: [],
          changedFields: [],
          removedFields: [],
          newSchemas: [],
          changedParserContracts: [],
          newStatusValues: [],
          persistedDataImpact: `${MOCK_TAG} Demo: no persisted data affected.`,
          backwardCompatibility: 'unclear',
          backwardCompatibilityNote: `${MOCK_TAG} Demo data — do not treat as real.`,
        },
        modelsAndTypes: [
          {
            name: `${MOCK_TAG} DemoType`,
            represents: `${MOCK_TAG} Demo representation.`,
            whyNeeded: `${MOCK_TAG} Demo rationale.`,
            importantFields: [`${MOCK_TAG} demoField: demo meaning`],
            evidence: 'inferred',
          },
        ],
        inputsApiFlags: [
          {
            name: `${MOCK_TAG} includeDemo`,
            kind: 'includeFlag',
            description: `${MOCK_TAG} Demo include flag.`,
            evidence: 'inferred',
          },
        ],
        workflowRuntimeChanges: {
          summary: `${MOCK_TAG} Demo workflow impact.`,
          whereItRuns: `${MOCK_TAG} Demo location.`,
          dependsOn: [`${MOCK_TAG} Demo dependency.`],
          consumesArtifacts: [`${MOCK_TAG} Demo artifact.`],
          producesArtifact: `${MOCK_TAG} Demo artifact.`,
          cachedOrReused: `${MOCK_TAG} Demo caching note.`,
          behaviorWhenFlagOff: `${MOCK_TAG} Demo off behavior.`,
        },
        uiChanges: {
          hasChanges: false,
          summary: `${MOCK_TAG} No UI changes in this demo diff.`,
          newCardsOrViews: [],
          togglesOrButtons: [],
          copyActions: [],
          sectionsDisplayed: [],
          howToActivate: `${MOCK_TAG} not visible from the provided diff/analysis`,
        },
        interestingFunctionality: [
          {
            title: `${MOCK_TAG} Demo functionality`,
            whatItDoes: `${MOCK_TAG} Demo behavior.`,
            whyItMatters: `${MOCK_TAG} Demo importance.`,
            howItWorks: `${MOCK_TAG} Demo internals.`,
            filesInvolved: [`${MOCK_TAG} demo/file.ts`],
          },
        ],
        howItWorksStepByStep: [
          { actor: 'User', action: `${MOCK_TAG} Enables the demo flag.` },
          { action: `${MOCK_TAG} Demo step runs.`, detail: `${MOCK_TAG} Demo detail.` },
        ],
        filesWorthShowing: [
          {
            path: `${MOCK_TAG} demo/file.ts`,
            whyItMatters: `${MOCK_TAG} Demo reason.`,
            whatToPointOut: `${MOCK_TAG} Demo highlight.`,
          },
        ],
        talkingPoints: [
          `${MOCK_TAG} Demo talking point one.`,
          `${MOCK_TAG} Demo talking point two.`,
        ],
      };
    }

    // The weekly review, like the technical change brief and demo prep loop,
    // depends only on the required base analysis and imposes no extra flags.
    if (request.includeWeeklyReview) {
      const generatedAt = new Date().toISOString();
      result.weeklyReview = {
        status: {
          status: 'draft',
          confidence: 'low',
          missingInputs: [`${MOCK_TAG} demo run — inputs not real`],
          reviewPeriodLabel: `Week ending ${generatedAt.slice(0, 10)}`,
          generatedAt,
        },
        executiveSummary: `${MOCK_TAG} Demo summary of the week.`,
        progressAgainstSpec: [
          {
            title: `${MOCK_TAG} Demo checklist item.`,
            status: 'unclear',
            evidence: `${MOCK_TAG} Demo evidence.`,
            notes: `${MOCK_TAG} Demo note.`,
            source: 'inferred',
          },
        ],
        whatChangedTechnically: {
          schemaOrDataChanges: [],
          modelOrTypeChanges: [{ description: `${MOCK_TAG} Demo type change.`, evidence: 'inferred' }],
          workflowOrRuntimeChanges: [],
          uiChanges: [],
          toolsOrSkillsAdded: [],
          importantFilesOrModules: [],
        },
        keyDecisions: [
          {
            decision: `${MOCK_TAG} Demo decision.`,
            why: `${MOCK_TAG} Demo rationale.`,
            impact: `${MOCK_TAG} Demo impact.`,
            status: 'open',
            source: 'inferred',
          },
        ],
        blockersAndRisks: [
          {
            title: `${MOCK_TAG} Demo blocker.`,
            whyItMatters: `${MOCK_TAG} Demo impact.`,
            status: 'open',
            suggestedNextAction: `${MOCK_TAG} Replace mock runner with real engine.`,
          },
        ],
        demoVideoStory: {
          strongestStory: `${MOCK_TAG} Demo story of the week.`,
          whatToShow: [`${MOCK_TAG} Demo thing to show.`],
          whatToSay: [`${MOCK_TAG} Demo thing to say.`],
          whatToSkip: [`${MOCK_TAG} Demo thing to skip.`],
          recommendedStructure: [
            { title: `${MOCK_TAG} Intro`, durationLabel: '~1 min', focus: `${MOCK_TAG} Demo focus.` },
          ],
          keyFilesOrScreens: [],
          strongestProductSentence: `${MOCK_TAG} Demo product sentence.`,
        },
        reviewTalkingPoints: [`${MOCK_TAG} Demo talking point.`],
        suggestedWeeklyUpdate: {
          thisWeek: `${MOCK_TAG} Demo this week.`,
          technicalProgress: `${MOCK_TAG} Demo technical progress.`,
          demoProductProgress: `${MOCK_TAG} Demo product progress.`,
          blockers: `${MOCK_TAG} Demo blockers.`,
          nextWeek: `${MOCK_TAG} Demo next week.`,
        },
        nextWeekPlan: [`${MOCK_TAG} Demo next-week item.`],
        memoryUpdateProposal: {
          latestWeeklySummary: `${MOCK_TAG} Demo weekly summary.`,
          updatedChecklistStatuses: [{ item: `${MOCK_TAG} Demo item.`, status: 'unclear' }],
          newDecisions: [`${MOCK_TAG} Demo decision.`],
          updatedBlockers: [`${MOCK_TAG} Demo blocker.`],
          nextActions: [`${MOCK_TAG} Demo next action.`],
          demoStorySummary: `${MOCK_TAG} Demo story summary.`,
          filesWorthShowing: [],
        },
      };
    }

    return result;
  }
}
