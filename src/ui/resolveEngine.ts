/**
 * Shared engine factory for the UI shell.
 *
 * Local dev (`src/ui/main.ts`) and the Vercel serverless entry (`api/index.ts`)
 * must build the SAME engine, or production silently drifts from local (that is
 * exactly how connected GitHub/Notion sources ended up wired only locally). This
 * module is the single source of truth for that wiring so the two entry points
 * cannot diverge again.
 *
 * It builds:
 *  - the analysis runner (real `AnalysisHarness` in `UI_MODE=real`, else the
 *    clearly-labelled mock runner);
 *  - the artifact-edit and guidance-refinement skills for the same mode;
 *  - and, in real mode, wires the configured Notion/GitHub connectors + source
 *    defaults into the harness via {@link resolveHarnessSourceDeps}.
 *
 * It does NOT construct or modify any AI provider: real mode uses
 * `OpenAICompatibleLanguageModel.fromEnv()` exactly as before.
 */
import {
  AnalysisHarness,
  OpenAICompatibleLanguageModel,
  resolveConnectors,
} from '../index.js';
import type { MemoryStore } from '../index.js';
import type { NotionConnector, GitHubConnector } from '../sources/index.js';
import { NotionWriteBackService } from '../notion/index.js';
import { DefaultArtifactEditSkill, type ArtifactEditSkill } from '../skills/artifactEdit/index.js';
import {
  DefaultGuidanceRefinementSkill,
  type GuidanceRefinementSkill,
} from '../skills/dailyWorkGuidanceRefinement/index.js';
import { MockArtifactEditSkill, MockGuidanceRefinementSkill } from '../skills/mocks/index.js';
import type { AnalysisRunner, UiMode } from './types.js';
import { HarnessAnalysisRunner, MockAnalysisRunner } from './analysisRunner.js';

/** The fully-resolved engine shared by the UI server and the serverless entry. */
export interface ResolvedEngine {
  runner: AnalysisRunner;
  mode: UiMode;
  artifactEditSkill: ArtifactEditSkill;
  guidanceRefinementSkill: GuidanceRefinementSkill;
  /**
   * Explicit Notion write-back. Always present; when Notion is not configured
   * its methods fail closed with a clear error. Independent of `UI_MODE`, since
   * write-back appends existing artifacts and needs no LLM provider.
   */
  notionWriteBack: NotionWriteBackService;
}

/**
 * The harness dependencies that carry configured source connectors, shaped so
 * they can be spread straight into `new AnalysisHarness({ ... })`. Connector
 * keys are present only when the corresponding connector was constructed, so
 * exact-optional harness options stay satisfied.
 *
 * Integrations are disabled by default; when
 * `SOURCE_INTEGRATIONS_ENABLED=true`, real Notion/GitHub connectors are
 * constructed from env (missing credentials warn/fail-open per
 * {@link resolveConnectors}). Extracted so local and production wire connectors
 * identically and so the wiring is unit-testable without OpenAI credentials.
 */
export function resolveHarnessSourceDeps(
  env: Record<string, string | undefined> = process.env,
): {
  notionConnector?: NotionConnector;
  githubConnector?: GitHubConnector;
  sourceDefaults: { notionPageId?: string; githubPrUrl?: string };
} {
  const connectors = resolveConnectors({ env });
  return {
    ...(connectors.notionConnector !== undefined
      ? { notionConnector: connectors.notionConnector }
      : {}),
    ...(connectors.githubConnector !== undefined
      ? { githubConnector: connectors.githubConnector }
      : {}),
    sourceDefaults: connectors.defaults,
  };
}

/**
 * Build the explicit Notion write-back service from env. It reuses the SAME
 * connector construction as reading ({@link resolveConnectors}), so it is wired
 * only when `SOURCE_INTEGRATIONS_ENABLED=true` and `NOTION_API_KEY` are set; the
 * default target page is `NOTION_DEFAULT_PAGE_ID`. It is provider-independent
 * (no OpenAI needed) and never sees or logs the API key (the connector holds it).
 */
export function resolveNotionWriteBack(
  env: Record<string, string | undefined> = process.env,
): NotionWriteBackService {
  const connectors = resolveConnectors({ env });
  return new NotionWriteBackService({
    ...(connectors.notionConnector !== undefined ? { connector: connectors.notionConnector } : {}),
    ...(connectors.defaults.notionPageId !== undefined
      ? { defaultPageId: connectors.defaults.notionPageId }
      : {}),
  });
}

/**
 * Build the engine for the current `UI_MODE`. The harness shares the SAME memory
 * store as the save endpoints, so memory saved from the UI is loaded on the next
 * run.
 */
export function resolveEngine(memoryStore: MemoryStore): ResolvedEngine {
  const notionWriteBack = resolveNotionWriteBack();
  if (process.env.UI_MODE === 'real') {
    const model = OpenAICompatibleLanguageModel.fromEnv();
    const harness = new AnalysisHarness({
      model,
      memoryStore,
      ...resolveHarnessSourceDeps(),
    });
    return {
      runner: new HarnessAnalysisRunner(harness),
      mode: 'real',
      artifactEditSkill: new DefaultArtifactEditSkill(model),
      guidanceRefinementSkill: new DefaultGuidanceRefinementSkill(model),
      notionWriteBack,
    };
  }
  return {
    runner: new MockAnalysisRunner(),
    mode: 'mock',
    artifactEditSkill: new MockArtifactEditSkill(),
    guidanceRefinementSkill: new MockGuidanceRefinementSkill(),
    notionWriteBack,
  };
}
