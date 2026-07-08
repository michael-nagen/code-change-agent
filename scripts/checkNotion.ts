/**
 * Local, mocked verification of the Notion end-to-end integration.
 *
 * Run with:  npm run check:notion
 *
 * It answers: "is Notion wired both ways — read into the agent, and explicit
 * write-back — end-to-end?" WITHOUT any real Notion key, page, or network. It
 * uses a deterministic MOCK Notion connector, spy skills that capture their
 * inputs, the in-memory memory store, and the MOCK analysis runner.
 *
 * It verifies, in order:
 *   1. connector wiring returns a Notion connector + default page from env;
 *   2. the Notion page is fetched and normalized;
 *   3. the Notion source appears in projectContext.sources;
 *   4. the formatted connected-source context contains the Notion title/text;
 *   5-8. Daily / Technical / Demo / Weekly skills each receive that context;
 *   9. the write-back formatter produces valid append content;
 *   10. the explicit write-back handler calls the connector's appendToPage;
 *   11. running analysis performs NO auto-write (append is never called).
 *
 * It is intentionally NOT a unit test (it is a runnable ops check), though it
 * asserts throughout and exits non-zero on any failure. No secret is printed.
 */
import assert from 'node:assert/strict';

import { AnalysisHarness } from '../src/analysis/AnalysisHarness.js';
import type { AnalysisResult } from '../src/analysis/index.js';
import { MockNotionConnector, formatProjectContextForPrompt } from '../src/sources/index.js';
import { resolveHarnessSourceDeps } from '../src/ui/resolveEngine.js';
import { MockAnalysisRunner, UiSessionStore, handleWriteNotion } from '../src/ui/index.js';
import { NotionWriteBackService, formatDailyForNotion } from '../src/notion/index.js';
import { InMemoryMemoryStore } from '../src/index.js';
import { setObservabilitySink } from '../src/observability/index.js';

import type { ChangeExplanation, ChangeExplanationSkill } from '../src/skills/changeExplanation/index.js';
import type {
  RequirementAlignment,
  RequirementAlignmentSkill,
} from '../src/skills/requirementAlignment/index.js';
import type { FlowArtifact, FlowGenerationSkill } from '../src/skills/flowGeneration/index.js';
import type { GapReport, GapReportSkill } from '../src/skills/gapReport/index.js';
import type {
  DailyWorkGuidance,
  DailyWorkGuidanceInput,
  DailyWorkGuidanceSkill,
} from '../src/skills/dailyWorkGuidance/index.js';
import type {
  TechnicalChangeBrief,
  TechnicalChangeBriefInput,
  TechnicalChangeBriefSkill,
} from '../src/skills/technicalChangeBrief/index.js';
import type {
  DemoPrepLoop,
  DemoPrepLoopInput,
  DemoPrepLoopSkill,
} from '../src/skills/demoPrepLoop/index.js';
import type {
  WeeklyReview,
  WeeklyReviewInput,
  WeeklyReviewSkill,
} from '../src/skills/weeklyReview/index.js';

const NOTION_PAGE_TEXT = 'Notion spec page — cache eviction policy and TTL rules.';
const REQUIREMENT = 'Add a durable cache with a spec-defined eviction policy.';
const RAW_DIFF = 'diff --git a/cache.ts b/cache.ts\n+CHECK_NOTION_DIFF_SENTINEL';

const CHANGE_EXPLANATION = {
  changeStory: 'Adds a cache.',
  keyFunctionalities: [],
  flow: [],
  mainComponents: [],
  architecturalDecisions: [],
  impactAnalysis: [],
  uncertainties: [],
} as ChangeExplanation;
const REQUIREMENT_ALIGNMENT = {
  requirementSummary: 'Add a cache',
  satisfiedItems: [],
  partiallySatisfiedItems: [],
  missingItems: [],
  unclearItems: [],
  overallAssessment: 'ok',
  confidence: 'high',
} as RequirementAlignment;
const FLOW_ARTIFACT = { title: 'Flow', description: 'd', steps: [], mermaid: 'flowchart TD\n A' } as FlowArtifact;
const GAP_REPORT = {
  readiness: 'unclear',
  completedWork: [],
  remainingGaps: [],
  partialItems: [],
  unclearItems: [],
  risks: [],
  recommendedNextActions: [],
  prRecommendation: 'n/a',
} as GapReport;

interface Captured {
  daily?: DailyWorkGuidanceInput;
  technical?: TechnicalChangeBriefInput;
  demo?: DemoPrepLoopInput;
  weekly?: WeeklyReviewInput;
}

function ok(label: string): void {
  console.log(`${label}: OK`);
}

async function main(): Promise<void> {
  // This is a wiring check, not an observability demo: silence the structured
  // run/step logs so the OK checklist stays readable.
  setObservabilitySink(() => {});
  console.log('Notion integration check (mocked — no real key/page/network)\n');

  // 1. Connector wiring: the SAME env-driven seam local + serverless use.
  const deps = resolveHarnessSourceDeps({
    SOURCE_INTEGRATIONS_ENABLED: 'true',
    NOTION_API_KEY: 'fake-key-not-a-secret',
    NOTION_DEFAULT_PAGE_ID: 'page-123',
  });
  assert.ok(deps.notionConnector, 'expected a Notion connector when enabled + key present');
  assert.equal(deps.sourceDefaults.notionPageId, 'page-123');
  ok('Connector wiring');

  // 2-8. Read → projectContext → prompt context → skills, via a mock connector
  // and spy skills that capture their inputs.
  const readConnector = new MockNotionConnector(NOTION_PAGE_TEXT);
  const captured: Captured = {};
  const harness = new AnalysisHarness({
    changeExplanation: spy(() => structuredClone(CHANGE_EXPLANATION)) as ChangeExplanationSkill,
    requirementAlignment: spy(() => structuredClone(REQUIREMENT_ALIGNMENT)) as RequirementAlignmentSkill,
    flowGeneration: spy(() => structuredClone(FLOW_ARTIFACT)) as FlowGenerationSkill,
    gapReport: spy(() => structuredClone(GAP_REPORT)) as GapReportSkill,
    dailyWorkGuidance: {
      name: 'spy-daily',
      async execute(input) {
        captured.daily = input;
        return {} as DailyWorkGuidance;
      },
    } as DailyWorkGuidanceSkill,
    technicalChangeBrief: {
      name: 'spy-technical',
      async execute(input) {
        captured.technical = input;
        return {} as TechnicalChangeBrief;
      },
    } as TechnicalChangeBriefSkill,
    demoPrepLoop: {
      name: 'spy-demo',
      async execute(input) {
        captured.demo = input;
        return {} as DemoPrepLoop;
      },
    } as DemoPrepLoopSkill,
    weeklyReview: {
      name: 'spy-weekly',
      async execute(input) {
        captured.weekly = input;
        return {} as WeeklyReview;
      },
    } as WeeklyReviewSkill,
    notionConnector: readConnector,
    sourceDefaults: { notionPageId: 'page-123' },
  });

  const result = await harness.runAnalysis({
    rawDiff: RAW_DIFF,
    requirementText: REQUIREMENT,
    includeFlow: true,
    includeGapReport: true,
    includeDailyWorkGuidance: true,
    includeTechnicalChangeBrief: true,
    includeDemoPrepLoop: true,
    includeWeeklyReview: true,
  });

  const notionSource = result.projectContext?.sources.find((s) => s.source.kind === 'notion');
  assert.ok(notionSource, 'expected a Notion source in projectContext.sources');
  assert.ok(notionSource.text.includes(NOTION_PAGE_TEXT), 'Notion source text should be the fetched page');
  ok('Notion read source');
  ok('Project context');

  const promptContext = formatProjectContextForPrompt({ projectContext: result.projectContext });
  assert.ok(promptContext, 'expected a formatted connected-source context');
  assert.match(promptContext, /Notion/, 'prompt context should mention Notion');
  assert.match(promptContext, /untrusted supporting context only/i, 'prompt context must be marked untrusted');
  assert.doesNotMatch(promptContext, /CHECK_NOTION_DIFF_SENTINEL/, 'the explicit diff must not be duplicated as connected context');
  ok('Prompt context');

  for (const [label, ctx] of [
    ['Daily', captured.daily?.connectedSourceContext],
    ['Technical', captured.technical?.connectedSourceContext],
    ['Demo', captured.demo?.connectedSourceContext],
    ['Weekly', captured.weekly?.connectedSourceContext],
  ] as const) {
    assert.ok(ctx, `${label} skill did not receive connected source context`);
    assert.match(ctx, /Notion/, `${label} context should mention Notion`);
    ok(`${label} source context`);
  }

  // Explicit inputs remain the source of truth (passed through unchanged).
  assert.equal(captured.technical?.requirementText, REQUIREMENT);
  assert.equal(captured.technical?.rawDiff, RAW_DIFF);

  // 9. Write-back formatter produces valid append content from a real artifact.
  const runnerResult: AnalysisResult = await new MockAnalysisRunner().run({
    requirementText: REQUIREMENT,
    rawDiff: RAW_DIFF,
    includeFlow: true,
    includeGapReport: true,
    includePrDescription: false,
    includeVideoScript: false,
    includeDailyUpdate: false,
    includeDailyWorkGuidance: true,
    includeTechnicalChangeBrief: false,
    includeDemoPrepLoop: true,
    includeWeeklyReview: true,
  });
  const daily = runnerResult.dailyWorkGuidance;
  assert.ok(daily, 'mock runner should produce Daily Work Guidance');
  const content = formatDailyForNotion({ guidance: daily, now: new Date().toISOString() });
  assert.match(content.title, /^Daily Work Guidance — /);
  assert.ok(content.body.includes('Today:'), 'formatted body should include the daily sections');
  ok('Write-back formatter');

  // 10. Explicit write-back handler calls appendToPage on the connector.
  const writeConnector = new MockNotionConnector();
  const service = new NotionWriteBackService({ connector: writeConnector, defaultPageId: 'page-123' });
  const store = new UiSessionStore();
  store.saveResult(runnerResult);
  const written = await handleWriteNotion({
    notionWriteBack: service,
    store,
    memoryStore: new InMemoryMemoryStore(),
    sessionId: runnerResult.sessionId,
    body: { source: 'dailyWorkGuidance', projectName: 'demo' },
  });
  assert.equal(written.status, 'success', 'explicit write-back should succeed');
  assert.ok(writeConnector.appended.length >= 1, 'appendToPage should be called by write-back');
  assert.ok(writeConnector.appended.every((c) => c.pageIdOrUrl === 'page-123'));
  ok('Explicit write-back handler');

  // 11. Auto-write safety: running the analysis never wrote to the read connector.
  assert.equal(readConnector.appended.length, 0, 'analysis must never auto-write to Notion');
  ok('Auto-write safety');

  console.log('\nResult: Notion read/write integration is wired correctly (mocked).');
}

/** A tiny spy skill wrapper for the base skills whose input we don't inspect. */
function spy<T>(make: () => T): { name: string; execute: () => Promise<T> } {
  return { name: 'spy', execute: async () => make() };
}

main().catch((err: unknown) => {
  console.error(`\nResult: FAILED\n${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
