/** Presentation: the Notion Text source form. Hidden until selected. */
export function notionForm(): string {
  return `    <div class="field-group hidden" id="group-notionText" data-mode-group="notionText">
      <p class="note">Paste copied/exported Notion content. Real Notion OAuth will come later.</p>
      <label for="notionText">Notion requirement / context text</label>
      <textarea id="notionText" rows="4" placeholder="Paste exported Notion text or copied Notion page content…"></textarea>
      <div style="height:12px"></div>
      <label for="nt_rawDiff">Raw diff</label>
      <textarea id="nt_rawDiff" class="mono" rows="10" placeholder="Paste a unified git diff…"></textarea>
    </div>`;
}
