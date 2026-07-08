/**
 * Presentation: the Project Command Center — the first-class surface that makes
 * a project feel "already connected".
 *
 * This file owns only the static mount and a no-JS fallback line. All dynamic
 * content (connected context panel, source visibility, and the one-click action
 * buttons) is rendered client-side by `commandCenterController`, because the
 * connected context lives in the browser (localStorage) and depends on the
 * current mode. The client fills `#command-center` on load.
 */
export function commandCenter(): string {
  return `  <div class="card cc-card" id="command-center-card">
    <div id="command-center">
      <div class="cc-eyebrow">Project Command Center</div>
      <p class="muted">Loading your connected project… If nothing appears, use Advanced / Manual Input below.</p>
    </div>
  </div>`;
}
