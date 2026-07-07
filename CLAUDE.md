# CLAUDE.md — Project Instructions & Code Review Rules

Project-level guidance for Claude/Cursor sessions working in this repository.
Read this before making changes, and review your diff against the **Code Review
Lessons** below before finishing.

## Product Direction

This project is a Code Change Understanding Agent.

It creates a source-of-truth analysis for a code change, then lets the developer
generate, refine, and export communication artifacts from that analysis.

Core principle:

Analyze once.
Work from the analysis.
Generate and edit outputs on demand.
Do not recompute everything every time.

Core flow:

1. User provides code change / diff / GitHub PR or commit URL / file input.
2. User provides requirement / task / product spec / Notion text / website context.
3. User runs initial analysis.
4. Initial analysis creates:

   * ChangeExplanation / What Changed
   * RequirementAlignment / Requirement Check
   * GapReport / PR Readiness
   * FlowArtifact / Feature Flow
5. Workspace opens.
6. Optional outputs are generated only on demand:

   * PRDescription / PR Draft
   * VideoScript / Walkthrough Script
   * DailyUpdate / Daily Prep
7. Generated outputs can be edited through side chat using ArtifactEditSkill.

## Architecture Rules

Layer boundaries:

Tools / Adapters:

* external I/O only
* Git, GitHub, website fetch, Notion, future Slack/Telegram/GitHub integrations
* no reasoning

Harness / Workflow:

* orchestration
* dependency validation
* session/artifact reuse
* artifact storage
* no LLM reasoning
* no prompt building

Skills:

* LLM-backed reasoning/generation/editing
* use injectable LanguageModel
* no hardcoded provider
* buildPrompt → LanguageModel.generate → JSON.parse → schema validation
* fail closed on invalid output
* return structured artifacts

UI:

* Analysis Workspace
* no Raw JSON by default
* one main content panel
* friendly artifact labels
* side chat for editing generated text artifacts
* copy/export focused

## Existing Skills

Base analysis skills:

* ChangeExplanationSkill
* RequirementAlignmentSkill
* GapReportSkill
* FlowGenerationSkill

On-demand output skills:

* PRDescriptionSkill
* VideoScriptSkill
* DailyUpdateSkill

Editing skill:

* ArtifactEditSkill

ArtifactEditSkill is a Skill, not a Tool.

It supports v1 editing for:

* prDescription
* dailyUpdate
* videoScript

It should not edit:

* rawDiff
* raw JSON
* base analysis artifacts in v1
* multiple artifacts at once

## Frontend Architecture Rules

Follow a feature-based structure similar to my chat-mvp convention.

Each frontend feature should have:

* `index.ts` as public surface
* `components/` for presentation-only rendering
* `model/` for constants, metadata, selectors, formatters, and pure logic
* `__tests__/` for tests
* types file when useful

Frontend separation rules:

* UI components should not call fetch directly.
* UI components should not own business/server logic.
* API calls should be isolated in `client/api.ts` or feature-level api files.
* Client state should be separated from rendering.
* Artifact metadata should have one source of truth.
* Formatting/copy logic should live outside layout components.
* `page.ts` should be composition only.

## Code Review Lessons

When refactoring:

* preserve behavior
* keep tests green
* avoid over-abstraction
* keep one responsibility per file where practical
* keep frontend/server/core boundaries clean
* do not change prompts during structure refactors
* do not change API contracts unless explicitly requested
* do not rewrite tests just to pass
* run typecheck and tests after meaningful steps

Function/API style:

* prefer single object arguments with named properties for multi-parameter functions
* avoid positional arguments when the meaning is not obvious

Testing:

* tests should live in colocated `__tests__/` folders
* do not remove tests unless behavior was intentionally removed
* update tests only for intentional public behavior/structure changes

Comments:

* comments should explain why, not repeat what the code does
* avoid noisy comments

Safety:

* do not leak secrets
* do not expose raw model output in product UI
* fail closed on invalid model output
* do not let UI/server handlers perform LLM reasoning

## Do Not Do Unless Explicitly Requested

Do not add:

* auth
* persistence/database
* deploy work
* Slack/Telegram integration
* always-on agent monitoring
* presentation/image generation
* real Notion OAuth
* GitHub write integration

Do not:

* regenerate all artifacts on every action
* make chat edit rawDiff
* silently edit multiple artifacts at once
* expose Raw JSON as a main product UI
* move reasoning into UI/server handlers
* make tools perform reasoning

## Future Direction

After workspace + chat editing are stable:

1. Prompt tuning based on real usage.
2. Better export/copy flows.
3. Notion export.
4. Slack/Telegram as external channels.
5. GitHub PR comment/description integration.
6. PresentationPlanSkill.
7. Slide renderer.
8. ImagePromptSkill / image generation.

Important:
Slack/Telegram should come after Artifact Chat is solid.
They are channels for the same workspace intelligence, not separate product brains.
