/**
 * The Analysis Workspace single-page shell (UI only).
 *
 * Flow: provide a source + requirement → "Run Initial Analysis" → a master/
 * detail workspace. A left navigation lists Overview, the base-analysis
 * artifacts, and the generatable outputs (each with a status chip). The main
 * panel shows exactly one selected item at a time, like a document viewer.
 *
 * On-demand generation is REAL: clicking "Generate …" re-calls /api/analyze with
 * the existing sessionId and the additional include flag, so the engine reuses
 * base artifacts and only runs the requested skill. Nothing is faked. Initial
 * analysis only runs the base understanding artifacts (flow + gap report).
 *
 * Raw JSON is not a normal nav item; it is hidden behind a "Show debug data"
 * toggle. Card bodies are rendered server-side (features/artifactViews).
 *
 * This file is composition only. The pieces live alongside it:
 *   - styles.ts               the stylesheet
 *   - features/appShell        the header + mode banner
 *   - features/analysisInput   the source + requirement input area
 *   - features/analysisWorkspace the status card + master/detail mount points
 *   - client/*                the inline browser app, split by responsibility
 */
import type { UiMode } from './types.js';
import { STYLES } from './styles.js';
import { appShell } from './features/appShell/index.js';
import { analysisInput } from './features/analysisInput/index.js';
import { statusSection, workspaceShell } from './features/analysisWorkspace/index.js';
import { clientScript } from './client/index.js';

/** Render the full single-page Analysis Workspace document for the UI mode. */
export function renderPage({ mode }: { mode: UiMode }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Code Change Understanding Agent</title>
<style>${STYLES}</style>
</head>
<body>
<div class="wrap">
${appShell(mode)}

${analysisInput()}

${statusSection()}

${workspaceShell()}
</div>
<script>${clientScript()}</script>
</body>
</html>`;
}
