/** Presentation: the display-only project-name card. */
export function projectCard(): string {
  return `  <div class="card">
    <h2>Project</h2>
    <label for="projectName">Project name (display only — no persistence yet)</label>
    <input type="text" id="projectName" placeholder="e.g. my-service" />
  </div>`;
}
