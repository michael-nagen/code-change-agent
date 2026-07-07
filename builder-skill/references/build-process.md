# Build Process

Follow this workflow for every task on this project.

1. **Understand the user request.** Restate the goal if it's ambiguous.
2. **Identify the architecture layer** — Product Spec, Harness, Skill, Tool,
   Output Generator, Test/Validation, or Documentation.
3. **Check the current milestone** (`current-milestone.md`). If the request is
   ahead of the milestone, flag it and confirm before proceeding.
4. **Check the relevant reference docs** for the layer involved (especially
   `architecture-principles.md` and `system-flow.md`).
5. **Propose a plan** — small and concrete. State which files you'll touch.
6. **Wait for approval if architecture changes are required.** Boundary changes,
   new layers, new frameworks/deps → ask first.
7. **Implement small changes.** Prefer the smallest reviewable diff.
8. **Run `npm run typecheck` and `npm run example`** when relevant to verify the
   change builds and the pipeline still runs.
9. **Summarize changes**: what changed, which files, how it fits the
   architecture, what remains mocked, and the recommended next step.

## Guardrails

- No scope creep. No speculative future features.
- Keep reasoning in Skills, orchestration in the Harness, side effects in Tools.
- Communication outputs derive from understanding, never from the raw diff.
