# Code Change Understanding Agent — Harness (V1)

The **orchestration layer** for the Code Change Understanding Agent. This
milestone builds *only* the Harness: lifecycle, session state, the two memory
layers, workflow execution, and recomputation avoidance.

This is a **change understanding** agent, not a codebase understanding agent.

```
Requirement + Diff  ->  Change Understanding  ->  Code Understanding Report
```

> All AI reasoning is mocked in V1. The goal is to validate the architecture,
> state management, and workflow orchestration — not the intelligence.

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
examples/runExample.ts
        │ uses
CodeUnderstandingHarness        (orchestration only — no reasoning)
   ├── SessionStore             (in-memory; owns SessionState + memory layers)
   ├── ChangeUnderstandingSkill (interface)  ──> Mock impl (V1)
   └── OutputGenerator[]        (interface)  ──> Mock report generator (V1)
```

- **Harness** sequences phases (`created → started → understood → reported`),
  guards step ordering, and skips recomputation (memory-first; `{ force: true }`
  to override). It delegates all reasoning to skills.
- **SessionStore** is in-memory only (no DB, files, or repository in V1). It
  holds **Understanding Memory** (`understanding`) and **Output Memory**
  (`outputs`) and returns immutable snapshots.
- **Skills / generators** carry all business logic. Mocked for now; swap in real
  implementations via the constructor without touching the Harness.

## API

```ts
const harness = new CodeUnderstandingHarness();   // defaults to mock skills

await harness.start({ requirement, diff });        // created -> started
await harness.buildUnderstanding();                // started -> understood
await harness.generateReport();                    // understood -> reported
const state = harness.getState();                  // immutable snapshot

// or the convenience pipeline:
const report = await harness.run({ requirement, diff });
```

## SessionState shape

```ts
{
  id: string;
  phase: 'created' | 'started' | 'understood' | 'reported';
  createdAt: string;
  updatedAt: string;
  inputs: { requirement: string; diff: string };
  understanding?: { /* Understanding Memory */ };
  outputs: { codeUnderstandingReport?: string /* Output Memory */ };
}
```

## Future extensions

- **New outputs** (PR description, video script, flow, presentation): add a key
  to `SessionOutputs`, implement `OutputGenerator`, and register it. The Harness
  is unchanged — `generate(key)` handles any registered generator.
- **Real LLM skills**: implement the existing interfaces and inject them.
- **Persistence**: swap `SessionStore` for a repository-backed store later
  (deliberately out of scope for V1).
- **Multi-session**: introduce a manager keyed by session `id` if needed.
