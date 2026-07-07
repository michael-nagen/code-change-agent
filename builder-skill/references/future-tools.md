# Future Tools

Tools perform **external actions or data access**. They contain **no reasoning**.
This list guides architecture — it is **not** a build list. Add a tool only when
a milestone needs it.

## Possible tools

- `GitDiffReaderTool` — read a git diff.
- `CommitReaderTool` — read commit metadata.
- `FileReaderTool` — read individual files.
- `RepositoryInspectorTool` — inspect repo structure.
- `TestRunnerTool` — run tests.
- `MarkdownExporterTool` — export markdown artifacts.
- `DiagramExporterTool` — export diagrams.
- `SlideExporterTool` — export slides.

## Rules

- Tools **act**; they do not reason. Keep all analysis in Skills.
- Do not add a tool until a milestone requires it.
- A tool should have a narrow, well-defined responsibility and a stable
  interface, so it can be swapped or mocked.
