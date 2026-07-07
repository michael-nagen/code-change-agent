/** Presentation: the Manual source form (requirement + raw diff). Visible by default. */
export function manualForm(): string {
  return `    <div class="field-group" id="group-manual" data-mode-group="manual">
      <label for="requirementText">Requirement</label>
      <textarea id="requirementText" rows="4" placeholder="Describe the requirement this change should satisfy…"></textarea>
      <div style="height:12px"></div>
      <label for="rawDiff">Raw diff</label>
      <textarea id="rawDiff" class="mono" rows="10" placeholder="Paste a unified git diff…"></textarea>
    </div>`;
}
