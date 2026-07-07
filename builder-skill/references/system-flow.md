# System Flow

## Input adapters (diff acquisition)

Diff acquisition is **separate** from diff understanding. Adapters are optional
and interchangeable; all normalize into the same `diff` input.

```
Input adapters (optional)
  ├─ Pasted diff
  ├─ Local GitDiffReaderTool   (exists; optional adapter, not in core pipeline)
  ├─ Future GitHub PR reader   (not built)
  └─ Future MCP reader         (not built)
        ↓  (all normalize to)
      diff
```

The reasoning layer consumes `diff` without caring about its source.

## Strategic flow

```
Stage 1 — Input
    Requirement + Diff   (diff obtained via any input adapter)
        ↓
Stage 2 — Change Explanation
    Create ChangeExplanation
        ↓
Stage 3 — Requirement Alignment
    Assess alignment between change and requirement
        ↓
Stage 4 — Report
    Create Code Understanding Report
        ↓
Stage 5 — Communication Outputs
    Generate PR Description, Video Script, Demo Flow, Slides, etc.
```

## Important rule

All communication outputs are generated from the **explanation / report**, NOT
directly from the raw diff. The diff is understood once; everything downstream
consumes that understanding.

## Current MVP flow

```
Requirement
   +
Diff            (from any input adapter — pasted, local git, etc.)
   ↓
ChangeExplanationSkill
   ↓
ChangeExplanation
   ↓
ReportGenerationSkill
   ↓
CodeUnderstandingReport
```

This MVP flow is what the Harness orchestrates. The next milestone builds the
real `ChangeExplanationSkill`; the flow itself stays the same. The Harness
receives an already-normalized `diff` and does not acquire it.
