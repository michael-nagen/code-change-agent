/** Presentation: the GitHub URL source form. Hidden until selected. */
export function githubForm(): string {
  return `    <div class="field-group hidden" id="group-githubUrl" data-mode-group="githubUrl">
      <label for="githubUrl">Public GitHub PR or commit URL</label>
      <input type="text" id="githubUrl" placeholder="https://github.com/owner/repo/pull/123" />
      <div style="height:12px"></div>
      <label for="gh_requirementText">Requirement</label>
      <textarea id="gh_requirementText" rows="4" placeholder="Describe the requirement this change should satisfy…"></textarea>
    </div>`;
}
