---
name: builder-skill
description: A Cursor-facing project builder skill for developing the Code Change Understanding Agent. Use it when planning, implementing, reviewing, or extending this project. It preserves product direction, the analyze-once/work-from-analysis flow, architecture boundaries (Tools, Harness, Skills, UI), the existing skill set, UI product rules, refactor rules, and what must not be built or broken yet.
---

# Builder Skill — Code Change Understanding Agent

This is the **control plane** for building this project. It is a builder skill for
Cursor, NOT a runtime skill inside the product. Read it before planning,
implementing, or reviewing work on this repo. This file is the short,
operational source of truth; it preserves the product direction so future work
stays aligned.

## Current Product Sentence

This product creates a **source-of-truth analysis for a code change**, then lets
the developer **generate, refine, and export communication artifacts** from that
analysis.

> המוצר יוצר ניתוח מקור-אמת לשינוי קוד, ואז מאפשר למפתח לייצר, לדייק ולייצא
> תוצרים על בסיס אותו ניתוח.

## Product Direction

This project is a **Code Change Understanding Agent**. It is **not** just a PR
description generator.

The product creates a source-of-truth analysis for a code change, then lets the
developer generate, refine, and export communication artifacts from that
analysis.

### Core flow

1. **User provides:**
   - code change / diff / GitHub PR or commit URL / file input
   - requirement / task / product spec / Notion text / website context
2. **User runs initial analysis.**
3. **Initial analysis creates the base artifacts:**
   - ChangeExplanation / What Changed
   - RequirementAlignment / Requirement Check
   - GapReport / PR Readiness
   - FlowArtifact / Feature Flow
4. **After initial analysis, the workspace opens.**
5. **Optional outputs are generated only on demand:**
   - PRDescription / PR Draft
   - VideoScript / Walkthrough Script
   - DailyUpdate / Daily Prep
6. **Generated outputs can be edited through side chat:**
   - `ArtifactEditSkill` edits the selected artifact.
   - It does not rerun the full analysis.
   - It does not re-analyze `rawDiff`.
   - It updates only the selected artifact.

### Core principle

> **Analyze once. Work from the analysis. Generate and edit outputs on demand.
> Do not recompute everything every time.**

## Architecture Direction

Keep these layer boundaries clean. A change that blurs them needs explicit
approval.

### Tools / Adapters

- external I/O only
- Git, GitHub, website fetch, Notion, future Slack/Telegram/GitHub integrations
- no reasoning

### Harness / Workflow

- orchestration
- dependency validation
- session/artifact reuse
- artifact storage
- no LLM reasoning
- no prompt building

### Skills

- LLM-backed reasoning/generation
- use injectable `LanguageModel`
- no hardcoded provider
- `buildPrompt → LanguageModel.generate → JSON.parse → schema validation`
- fail closed on invalid output
- return structured artifacts

### UI

- Analysis Workspace
- user-friendly artifact labels
- no raw JSON as primary UI
- one main content panel
- side chat for editing generated text artifacts
- copy/export focused

## Existing Skills

**Base analysis skills:**

- `ChangeExplanationSkill`
- `RequirementAlignmentSkill`
- `GapReportSkill`
- `FlowGenerationSkill`

**On-demand output skills:**

- `PRDescriptionSkill`
- `VideoScriptSkill`
- `DailyUpdateSkill`

**Editing skill:**

- `ArtifactEditSkill`

`ArtifactEditSkill` is a **Skill, not a Tool**. It supports v1 editing for:

- `prDescription`
- `dailyUpdate`
- `videoScript`

It must **not** edit:

- raw JSON
- `rawDiff`
- base analysis artifacts in v1
- multiple artifacts at once

## UI Product Rules

- Initial analysis should **not** generate every possible output.
- Initial analysis should generate only:
  - What Changed
  - Requirement Check
  - PR Readiness
  - Feature Flow
- After the workspace exists, the user can choose:
  - Generate PR Draft
  - Generate Walkthrough Script
  - Generate Daily Prep
- The user can then chat-edit generated text artifacts.
- The UI should feel like a **product workspace, not a debug page**.
- Do **not** show Raw JSON by default.

## Refactor Rules

When refactoring:

- preserve behavior
- keep tests green
- avoid over-abstraction
- keep one responsibility per file where practical
- keep frontend/server/core boundaries clean
- do not change prompts during structure refactors
- do not change API contracts unless explicitly requested
- do not rewrite tests just to pass
- run `typecheck` and tests after meaningful steps

## Do Not Do Yet (Unless Explicitly Requested)

Do **not** add:

- auth
- persistence/database
- deploy work
- Slack/Telegram integration
- always-on agent monitoring
- presentation/image generation
- real Notion OAuth
- GitHub write integration

Do **not**:

- regenerate all artifacts on every action
- make chat edit `rawDiff`
- silently edit multiple artifacts at once
- expose raw model output in product UI
- move reasoning into UI/server handlers
- make tools perform reasoning

## Future Direction

After the current workspace + chat editing flow is stable, future milestones are:

1. Prompt tuning based on real usage.
2. Better export/copy flows.
3. Notion export.
4. Slack/Telegram as external channels.
5. GitHub PR comment/description integration.
6. `PresentationPlanSkill`.
7. Slide renderer.
8. `ImagePromptSkill` / image generation.

> **Important:** Slack/Telegram come **after** Artifact Chat is solid. They are
> channels for the same workspace intelligence, not separate product brains.

## How to use this skill

Whenever you work on this project:

1. **Identify the layer** the task belongs to: Tool/Adapter, Harness/Workflow,
   Skill, or UI.
2. **Respect the core principle:** analyze once, work from the analysis, generate
   and edit on demand — never recompute everything.
3. **Preserve architecture boundaries** (see Architecture Direction above).
4. **Avoid scope creep.** Never implement future features (see Do Not Do Yet)
   unless explicitly requested.
5. **Ask before changing architecture or API contracts.**
6. **Prefer small, reviewable changes.** One responsibility per file where
   practical.
7. **Run `typecheck` and tests after meaningful steps;** do not rewrite tests
   just to pass.
8. **After implementation, summarize:** what changed, which files changed, how it
   fits the architecture, and the recommended next step.

## Reference map

The detailed reference docs describe the original early-milestone framing and may
lag behind this file. **This SKILL.md is authoritative** for product and
architecture direction; consult references for deeper historical context only.

- `references/project-spec.md` — original product goal, problem, inputs/outputs.
- `references/architecture-principles.md` — layer responsibilities, memory model,
  lifecycle, caching, extensibility.
- `references/build-process.md` — step-by-step workflow.
- `references/current-milestone.md` — historical milestone notes.
- `references/product-roadmap.md` — phased roadmap (see Future Direction above
  for the current view).
- `references/future-skills.md` / `references/future-tools.md` — anticipated
  skills/tools (guidance, not a build list).
- `references/system-flow.md` — strategic flow + earlier MVP flow.

## Golden rule

All communication outputs (PR draft, walkthrough script, daily prep, flow, ...)
are generated and edited **from the analysis artifacts**, never directly from the
raw diff. Analyze once; everything downstream works from that analysis.
