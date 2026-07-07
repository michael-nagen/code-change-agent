# Skills

Skills are where **all business reasoning** lives. The Harness depends only on
the interfaces in `src/types/skills.ts`, never on concrete implementations.

## V1

Only mock implementations exist (see `mocks/`). They return fake, deterministic
data. Their sole purpose is to validate the Harness architecture and workflow.

## Adding a real skill

Implement the relevant interface and inject it via the Harness constructor:

```ts
new CodeUnderstandingHarness({ changeUnderstanding: new RealChangeUnderstandingSkill() });
```

## Adding a new output generator (future)

1. Add the output key to `SessionOutputs` in `src/types/session.ts`.
2. Implement `OutputGenerator` for that key.
3. Register it: `harness.registerGenerator(new VideoScriptGenerator())`,
   or pass it in `skills.generators` at construction.

The Harness needs **no changes** — `generate(key)` handles any registered
generator uniformly.
