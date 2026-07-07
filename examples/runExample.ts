/**
 * End-to-end example using the V2 AnalysisHarness with deterministic mock models.
 *
 * Run with: npm run example
 *
 * Demonstrates: construct the harness with per-skill mock models -> run the
 * AnalyzeCodeChange workflow (requirement + diff -> base analysis + flow + gap
 * report) -> inspect the result -> re-run with the same sessionId to show that
 * already-computed artifacts are reused and their skills are not called again.
 */
import {
  AnalysisHarness,
  DefaultChangeExplanationSkill,
  DefaultRequirementAlignmentSkill,
  DefaultFlowGenerationSkill,
  DefaultGapReportSkill,
  FakeLanguageModel,
} from '../src/index.js';

const requirement = `As a user, I want a "Mark all as read" button on the
notifications page so I can clear my unread count in one click.`;

const diff = `diff --git a/src/notifications/NotificationList.tsx b/src/notifications/NotificationList.tsx
@@
+  const markAllRead = () => dispatch(markAllNotificationsRead());
+  <button onClick={markAllRead}>Mark all as read</button>
diff --git a/src/store/notifications.ts b/src/store/notifications.ts
@@
+export const markAllNotificationsRead = createAction('notifications/markAllRead');`;

// Each skill gets its own deterministic model that returns the JSON shape its
// parser expects. Swap any of these for a real LanguageModel-backed skill (or a
// single shared `model`) without changing the harness.
const changeExplanationModel = new FakeLanguageModel(
  JSON.stringify({
    changeStory:
      'Adds a "Mark all as read" action to the notifications page, wiring a button to a ' +
      'new Redux action that clears the unread count in one click.',
    keyFunctionalities: [
      'Adds a "Mark all as read" button to the notification list',
      'Introduces a markAllNotificationsRead action',
    ],
    flow: ['User clicks the button', 'Action dispatched', 'Unread count cleared'],
    mainComponents: [
      { name: 'NotificationList', responsibility: 'Renders notifications and the new button.' },
      { name: 'notifications store', responsibility: 'Defines the mark-all-read action.' },
    ],
    architecturalDecisions: ['Reuse the existing Redux action pattern for consistency.'],
    impactAnalysis: ['Notification list UI gains one action; store gains one action creator.'],
    uncertainties: ['Whether the reducer handling this action already exists.'],
  }),
);

const flowModel = new FakeLanguageModel(
  JSON.stringify({
    title: 'Mark all notifications as read',
    description: 'A single click clears the unread count for all notifications.',
    steps: ['Click "Mark all as read"', 'Dispatch markAllNotificationsRead', 'Unread count resets'],
    mermaid: 'flowchart TD\n  A[Click button] --> B[Dispatch action] --> C[Unread count reset]',
  }),
);

const requirementAlignmentModel = new FakeLanguageModel(
  JSON.stringify({
    requirementSummary: 'Provide a one-click "Mark all as read" control on the notifications page.',
    satisfiedItems: ['A "Mark all as read" button is added and wired to a clear-all action.'],
    partiallySatisfiedItems: [],
    missingItems: [],
    unclearItems: ['Whether the reducer fully resets the unread count.'],
    overallAssessment: 'The change appears to satisfy the core requirement.',
    confidence: 'medium',
  }),
);

const gapReportModel = new FakeLanguageModel(
  JSON.stringify({
    readiness: 'needs_changes',
    completedWork: ['Button and action are implemented.'],
    remainingGaps: ['Confirm the reducer handles markAllNotificationsRead.'],
    partialItems: [],
    unclearItems: ['Reducer behavior is not shown in the diff.'],
    risks: ['Unread count may not reset if the reducer is missing.'],
    recommendedNextActions: ['Add or verify the reducer case and a test.'],
    prRecommendation: 'Nearly ready — verify reducer handling before merge.',
  }),
);

async function main(): Promise<void> {
  const harness = new AnalysisHarness({
    changeExplanation: new DefaultChangeExplanationSkill(changeExplanationModel),
    requirementAlignment: new DefaultRequirementAlignmentSkill(requirementAlignmentModel),
    flowGeneration: new DefaultFlowGenerationSkill(flowModel),
    gapReport: new DefaultGapReportSkill(gapReportModel),
  });

  // 1. Run the analysis (defaults include the flow + gap report).
  const result = await harness.runAnalysis({ rawDiff: diff, requirementText: requirement });

  console.log('Session:', result.sessionId);
  console.log('\n=== Change Story ===');
  console.log(result.changeExplanation.changeStory);
  console.log('\n=== Requirement Alignment ===');
  console.log('Confidence:', result.requirementAlignment.confidence);
  console.log(result.requirementAlignment.overallAssessment);
  if (result.flowArtifact !== undefined) {
    console.log('\n=== Feature Flow ===');
    console.log(result.flowArtifact.title);
    for (const step of result.flowArtifact.steps) {
      console.log(' ↓', step);
    }
  }
  if (result.gapReport !== undefined) {
    console.log('\n=== PR Readiness ===');
    console.log('Readiness:', result.gapReport.readiness);
    console.log(result.gapReport.prRecommendation);
  }

  // 2. Re-run with the same sessionId: existing artifacts are reused, so the
  // skills are NOT called again (recomputation avoidance).
  const callsBefore = changeExplanationModel.calls.length;
  await harness.runAnalysis({
    rawDiff: diff,
    requirementText: requirement,
    sessionId: result.sessionId,
  });
  const callsAfter = changeExplanationModel.calls.length;
  console.log('\nChange-explanation skill re-invoked on second run:', callsAfter !== callsBefore);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
