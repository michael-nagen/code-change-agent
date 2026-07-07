# Future Skills

Skills contain **reasoning**. This list guides architecture decisions — it is
**not** a build list. Do not implement these preemptively.

## Current / near-term

- `ChangeUnderstandingSkill` — Requirement + Diff → `ChangeUnderstanding`.
  (Phase 2, current milestone.)
- `CodeUnderstandingReportSkill` — understanding → report. (Phase 3.)

## Future (guidance only)

- `RequirementUnderstandingSkill` — deeper parsing of the requirement.
- `DiffUnderstandingSkill` — deeper analysis of the diff.
- `GoalAlignmentSkill` — assess alignment between change and requirement.
- `FlowGenerationSkill` — derive a flow from understanding.
- `PRDescriptionSkill` — PR description from understanding/report.
- `VideoScriptSkill` — narration script.
- `PresentationScriptSkill` — presentation narration.
- `SlideOutlineSkill` — slide outline.

## Why list them now

These exist to keep architecture decisions future-proof (stable interfaces,
clean seams). **They should not all be built now.** Build only the skill the
current milestone requires.
