# Architecture Principles

## The four layers (strict separation)

```
Harness          = orchestration
Skills           = reasoning
Tools            = external actions / data access
Output Generators = communication artifacts from understanding
```

Keep these boundaries clean. A change that blurs them needs explicit approval.

### Harness responsibilities

- Receive inputs.
- Own session state and the two memory layers.
- Run workflow steps in order.
- Avoid recomputation (caching).
- Provide generated outputs.
- **No business reasoning.** The Harness orchestrates; it never analyzes.

### Skill responsibilities

- Contain all **reasoning** (e.g. analyze requirement + diff → understanding).
- Implement a stable interface so mock and real versions are swappable.
- Be injected into the Harness; never reach into Harness internals.

### Tool responsibilities

- Perform **external actions or data access** (read a diff, run tests, export a
  file).
- Contain **no reasoning**.
- Be added only when a milestone needs them.

## Input adapters (diff acquisition)

**Core rule: diff acquisition is separate from diff understanding.**

An input adapter's only job is to obtain a diff and normalize it into the
standard input the reasoning layer expects: a **diff string** (or a
`GitDiffResult` carrying it). Adapters are optional and interchangeable.

- `GitDiffReaderTool` — obtains a diff from a local git repository. It is an
  **optional local input adapter**, NOT part of the core reasoning pipeline.
- Future adapters (do not build yet): GitHub PR reader, MCP reader, uploaded
  file, pasted text.

Every adapter produces the same normalized `diff`. The reasoning skill
(`ChangeExplanationSkill`) **must not care where the diff came from** — pasted,
local git, GitHub, or MCP all converge to one input shape.

```
Input adapters (optional, interchangeable)
  ├─ Pasted diff
  ├─ Local GitDiffReaderTool
  ├─ Future GitHub PR reader
  └─ Future MCP reader
        ↓  (all normalize to)
      diff
        ↓
  ChangeExplanationSkill → ChangeExplanation
```

What this rule forbids (for now): wiring `GitDiffReaderTool` into the Harness,
adding `startFromGit()`, or making the Harness responsible for acquiring diffs.
The Harness receives an already-normalized diff.

### Output Generator responsibilities

- Transform **understanding** into **communication artifacts** (report, PR
  description, slides, ...).
- Read from Understanding Memory, not from the raw diff.
- Register with the Harness via the generator registration pattern.

## Session Memory model

A single central `SessionState` holds everything, with two memory layers:

### Understanding Memory

Structured understanding of the change (`SessionState.understanding`):
`requirementSummary`, `whatChanged`, `keyFunctionality`, `goalAlignment`,
`mainComponents`.

### Output Memory

Generated artifacts (`SessionState.outputs`), e.g. `codeUnderstandingReport`.
Future outputs are added as new keys.

## Lifecycle phases

```
created → started → understood → reported
```

The Harness guards step ordering by phase and only advances forward (re-runs are
idempotent).

## Caching / recomputation avoidance

- Steps are **memory-first**: if the result already exists, return it.
- Re-run only when missing or when `{ force: true }` is passed.
- This keeps reasoning/generation from running twice for the same session.

## Extensibility rules

- **New output** → add a key to `SessionOutputs`, implement an `OutputGenerator`,
  register it. The Harness needs no changes (`generate({ key })` is generic).
- **Real skill** → implement the existing skill interface and inject it via the
  Harness constructor.
- **New tool** → only when a milestone requires it; keep it reasoning-free.

## Scope boundaries

- Build only what the current milestone requires.
- Do not implement future skills/tools/outputs preemptively.
- Persistence is intentionally out of scope (V1 store is in-memory).
- Ask before introducing frameworks, DI containers, event buses, or queues.
