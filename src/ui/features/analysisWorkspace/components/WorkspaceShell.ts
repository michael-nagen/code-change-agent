/**
 * Presentation: the workspace containers — the pre-analysis placeholder, and
 * the master/detail layout (nav | content panel | side chat) that the client
 * app renders into after an analysis runs. This file owns only the empty mount
 * points; all dynamic rendering happens client-side.
 */
export function workspaceShell(): string {
  return `  <div id="workspace-empty" class="card placeholder">
    Your analysis workspace will appear here after you run an initial analysis.
  </div>

  <div id="workspace" class="hidden">
    <div class="layout">
      <div class="nav" id="nav"></div>
      <div class="panel panel-accent-overview" id="panel"></div>
      <div class="chat hidden" id="chat"></div>
    </div>
  </div>`;
}
