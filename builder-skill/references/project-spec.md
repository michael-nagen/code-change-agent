# Project Spec

## Product goal

Help developers **understand and explain code changes** they made — quickly,
and without needing to reopen or re-read the codebase.

## Core problem

After implementing a change, a developer must explain it: in a PR, a standup, a
demo, or a review. Reconstructing "what changed and why" from a raw diff is slow
and error-prone. The product turns a requirement + diff into a clear,
structured understanding and a readable report.

## Target user

Software developers who need to explain a change they implemented — to
reviewers, teammates, or stakeholders.

## Inputs

- **Requirement** — free-text description of what was requested (assignment
  spec, Jira ticket, GitHub issue, product requirement).
- **Git Diff** — the code changes that were implemented.

## Outputs

- **Change Understanding** — structured understanding of the change.
- **Code Understanding Report** — a readable report derived from the
  understanding.

(Future communication outputs are listed in `product-roadmap.md` and
`system-flow.md`.)

## Success metric

A developer can explain their change accurately from the generated report
without reopening the codebase.

## MVP scope

```
Requirement + Diff → Change Understanding → Code Understanding Report
```

## Non-goals

- Full codebase / repository understanding.
- Repository scanning or file exploration.
- PR descriptions, video scripts, slides, flow/diagram generation (future).
- Long-term memory.
- Real LLM integration is only introduced milestone-by-milestone.

## Important product definition

> The product helps developers explain changes they made **without needing to
> reopen the codebase**.
