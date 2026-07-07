# Skills

Skills are where **all business reasoning** lives. The `AnalysisHarness`
(`src/analysis/`) depends only on the skill interfaces (e.g.
`ChangeExplanationSkill`, `GapReportSkill`), never on concrete implementations.

Each skill follows the same shape: `buildPrompt → LanguageModel.generate →
parseOutput`, and fails closed on invalid model output.

## Mocks

Provider-free test doubles live in `mocks/` (`MockLanguageModel`,
`FakeLanguageModel`, `MockArtifactEditSkill`). They return deterministic data so
the harness, workflow, and UI can be exercised without a live model.

## Adding a real (or test) skill

Implement the relevant `LanguageModel`-backed skill and inject it via the
harness constructor. Inject a single shared `model` to construct the default
skills, or override any individual skill:

```ts
new AnalysisHarness({ model }); // default LLM-backed skills
new AnalysisHarness({ changeExplanation: new DefaultChangeExplanationSkill(model) });
```

## Adding a new output skill

1. Add the artifact key to the analysis session/result types in
   `src/analysis/types/`.
2. Implement the skill (prompt + parser) under `src/skills/<name>/`.
3. Add a step to `src/analysis/workflowDefinition.ts` (order, dependencies, and
   its `includeFlag`) and register it in `AnalysisHarness`.

The workflow runner reuses already-computed artifacts automatically, so a newly
added optional output slots into the "analyze once" caching without special
handling.
