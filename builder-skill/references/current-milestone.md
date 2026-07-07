# Current Milestone

## Build ChangeExplanationSkill.

### Goal

Build a `ChangeExplanationSkill` that consumes a **diff** (plus the requirement)
and produces a structured `ChangeExplanation`. It is a reasoning Skill that
implements a stable interface and is injectable into the Harness.

The skill must not care where the diff came from — pasted text, local git, or a
future GitHub/MCP adapter all converge to the same `diff` input.

### Done when

- A real `ChangeExplanationSkill` exists and conforms to its interface.
- It consumes a normalized `diff` (+ requirement) and returns a structured
  `ChangeExplanation`.
- Reasoning lives entirely in the skill; the Harness remains pure orchestration.
- The project typechecks and the example/pipeline still runs.

## GitDiffReaderTool status

- `GitDiffReaderTool` **exists** as an **optional local input adapter**.
- It is **not** part of the core MVP reasoning pipeline.
- It is **not** wired into the Harness, and must not be this milestone.
- Git tooling work is **paused** — do not expand it further now.

## Explicitly NOT included yet

- Connecting `GitDiffReaderTool` to the Harness.
- `startFromGit()` or making the Harness acquire diffs.
- GitHub / MCP / file-upload input adapters.
- Further Git tooling.
- Requirement Alignment, Report improvement, PR / Video / Flow / Slides outputs.
- Repo scanning, file exploration, real long-term memory, full codebase
  understanding.

Do not build any of the above as part of this milestone.

## Next milestone

Requirement Alignment — assess how well the change aligns with the requirement,
consuming the `ChangeExplanation`.
