# Product Roadmap

Phased plan. Build one phase at a time; do not jump ahead.

## Phase 1 — Harness V1 (DONE)

Already implemented: `CodeUnderstandingHarness`, `SessionStore`, `SessionState`,
Understanding Memory, Output Memory, lifecycle phases
(`created → started → understood → reported`), `MockChangeUnderstandingSkill`,
`MockReportGenerationSkill`, `run()` convenience method, caching /
recomputation avoidance, generator registration pattern.

## Phase 2 — GitDiffReaderTool (DONE — optional input adapter)

Built. Reads the local git diff and returns raw diff text + changed files +
basic stats. Data access only, no reasoning.

> **Architectural role:** `GitDiffReaderTool` is an **optional local input
> adapter**, not part of the core reasoning pipeline. Diff acquisition is
> separate from diff understanding (see `architecture-principles.md`). It is
> NOT wired into the Harness, and git tooling work is paused.

## Phase 3 — ChangeExplanationSkill (CURRENT)

Consume a normalized `diff` (+ requirement) → structured `ChangeExplanation`.
The skill is source-agnostic about where the diff came from. See
`current-milestone.md`.

## Phase 4 — Requirement Alignment

Assess how well the change aligns with the requirement, from the
`ChangeExplanation`.

## Phase 5 — Code Understanding Report improvement

Turn the explanation/alignment into a higher-quality, readable report (real
`ReportGenerationSkill`).

## Phase 6 — Flow Builder

Generate a demo/flow representation from the explanation.

## Phase 7 — PR Description Generator

Generate a PR description from the explanation/report.

## Phase 8 — Video / Presentation Script Generator

Generate narration/script artifacts.

## Phase 9 — Slides / Diagram generation

Generate slide outlines and flow diagrams.

## Phase 10 — Additional input adapters & Git tooling

Future input adapters (GitHub PR reader, MCP reader, file upload) and further
git tooling — only if a milestone needs them. All adapters normalize to the same
`diff` input.
