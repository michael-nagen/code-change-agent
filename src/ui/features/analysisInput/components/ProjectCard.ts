/** Presentation: the project-name card. */
export function projectCard(): string {
  return `  <div class="card">
    <h2>Project</h2>
    <label for="projectName">Project name — used to connect and remember this project's context (spec, source, memory) in your browser</label>
    <input type="text" id="projectName" placeholder="e.g. my-service" />
  </div>`;
}
