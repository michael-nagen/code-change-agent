/**
 * UI v0 entry point.
 *
 * Defaults to MOCK/DEMO mode so the shell runs with zero AI configuration and
 * never emits output that could be mistaken for real AI.
 *
 * Opt into the real engine with `UI_MODE=real`. That path builds the official
 * V2 `AnalysisHarness` from the existing `OpenAICompatibleLanguageModel` (via
 * its own `fromEnv()` — this file does not implement or modify the provider).
 * Real mode therefore requires the same env as `npm run smoke:real-ai`
 * (OPENAI_API_KEY, OPENAI_MODEL, optional OPENAI_BASE_URL).
 */
import {
  AnalysisHarness,
  OpenAICompatibleLanguageModel,
} from '../index.js';
import { DefaultArtifactEditSkill, type ArtifactEditSkill } from '../skills/artifactEdit/index.js';
import { MockArtifactEditSkill } from '../skills/mocks/index.js';
import type { AnalysisRunner, UiMode } from './types.js';
import { HarnessAnalysisRunner, MockAnalysisRunner } from './analysisRunner.js';
import { createUiServer } from './server.js';

function resolveRunner(): {
  runner: AnalysisRunner;
  mode: UiMode;
  artifactEditSkill: ArtifactEditSkill;
} {
  if (process.env.UI_MODE === 'real') {
    const model = OpenAICompatibleLanguageModel.fromEnv();
    const harness = new AnalysisHarness({ model });
    return {
      runner: new HarnessAnalysisRunner(harness),
      mode: 'real',
      artifactEditSkill: new DefaultArtifactEditSkill(model),
    };
  }
  return {
    runner: new MockAnalysisRunner(),
    mode: 'mock',
    artifactEditSkill: new MockArtifactEditSkill(),
  };
}

function main(): void {
  const port = Number(process.env.PORT ?? 5173);
  const { runner, mode, artifactEditSkill } = resolveRunner();
  const server = createUiServer({ runner, mode, artifactEditSkill });

  server.listen(port, () => {
    const tag = mode === 'mock' ? 'MOCK/DEMO (fake data)' : 'REAL engine';
    // eslint-disable-next-line no-console
    console.log(`UI v0 running at http://localhost:${port}  [${tag}, runner=${runner.name}]`);
    if (mode === 'mock') {
      // eslint-disable-next-line no-console
      console.log('Set UI_MODE=real (with OpenAI env vars) to use the real analysis engine.');
    }
  });
}

main();
