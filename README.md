# Code Change Understanding Agent

An agent that turns a **code change** into a source-of-truth analysis, then
generates and edits communication artifacts (PR description, walkthrough script,
daily update) from that analysis.

This is a **change understanding** agent, not a codebase understanding agent.

```
Requirement + Diff
  -> Change Explanation  (What Changed)
  -> Feature Flow        (optional)
  -> Requirement Alignment (Requirement Check)
  -> Gap Report          (PR Readiness, optional)
  -> PR Description / Video Script / Daily Update (on demand)
```

> Reasoning lives in LLM-backed **skills**; the harness orchestrates them and
> never reasons itself. Provider-free mock models are available for tests and
> examples so the whole pipeline can run without a live model.

## Requirements

- Node.js 22+
- npm
- TypeScript + tsx (no frameworks, no DI containers, no event buses, no queues)

## Setup & run

```bash
npm install
npm run example     # runs examples/runExample.ts via tsx
npm run typecheck   # tsc --noEmit
```

## Running the real AI smoke test

A manual, dev-only smoke test that exercises the full pipeline against a **real**
OpenAI-compatible provider. It is **not** part of `npm test` and is never run by
the unit tests.

```bash
cp .env.example .env
# paste your OPENAI_API_KEY into .env
npm run smoke:real-ai
```

Notes:

- This is a **manual / dev** smoke test, separate from the normal unit tests.
- It calls the **real** provider, so it may **cost money**.
- It prints only artifact keys and short excerpts — never full dumps.
- It **never** prints API keys or other secrets.
- Without a real key it fails clearly (exit code 1) with a config error.

`.env` is loaded automatically for this script via `dotenv` (a dev dependency
used only by the smoke script). Production code never depends on `dotenv`, and
skills never read the environment. `.env` and `.env.local` are gitignored;
`.env.example` is tracked.

## Architecture

```
examples/runExample.ts / src/ui
        │ uses
AnalysisHarness                 (orchestration only — no reasoning)
   ├── AnalyzeCodeChangeWorkflow (step sequencing + artifact reuse)
   ├── SkillRegistry            (LLM-backed skills, injected or built from a model)
   ├── ArtifactStore            (in-memory session/artifact storage)
   └── Input adapters           (git, requirement, Notion — external I/O only)
```

- **AnalysisHarness** (`src/analysis/AnalysisHarness.ts`) wires adapters and
  skills into the workflow, stores sessions, and reuses artifacts. It builds no
  prompts, parses no model output, and interprets no diffs — that is all in
  skills.
- **Workflow** (`src/analysis/AnalyzeCodeChangeWorkflow.ts`, shape declared in
  `workflowDefinition.ts`) runs the steps in order and skips any step whose
  artifact already exists on the session ("analyze once").
- **Skills** (`src/skills/*`) carry all reasoning. Inject real
  `LanguageModel`-backed skills, a single shared `model`, or mock models.
- **Stores** are in-memory (no DB in this milestone): `InMemoryArtifactStore`
  for sessions and `InMemoryProjectStore` for projects.

## API

```ts
// Inject a single model to build the default LLM-backed skills…
const harness = new AnalysisHarness({ model });
// …or inject individual skills (e.g. mock models) for tests/examples.

const result = await harness.runAnalysis({ rawDiff, requirementText });

// Reuse a prior session: existing artifacts are kept and only newly-requested
// outputs are generated.
await harness.runAnalysis({
  rawDiff,
  requirementText,
  sessionId: result.sessionId,
  includePrDescription: true,
});
```

## AnalysisResult shape (abridged)

```ts
{
  sessionId: string;
  requirementInput: { requirementText: string; source: string };
  changeExplanation: { /* What Changed */ };
  requirementAlignment: { /* Requirement Check */ confidence: string };
  flowArtifact?: { /* Feature Flow */ };
  gapReport?: { /* PR Readiness */ readiness: string };
  prDescription?: { /* on demand */ };
  videoScript?: { /* on demand */ };
  dailyUpdate?: { /* on demand */ };
}
```

## Future extensions

- **New outputs**: add a step to `workflowDefinition.ts`, implement the skill,
  and register it in `AnalysisHarness`. The workflow reuse logic is unchanged.
- **Real LLM skills**: implement the skill interfaces and inject them.
- **Persistence**: swap the in-memory stores for repository-backed ones later.
