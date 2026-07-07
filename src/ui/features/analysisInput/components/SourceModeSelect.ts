/** Presentation: the source-mode selector and its description line. */
export function sourceModeSelect(): string {
  return `    <label for="inputMode">Source mode</label>
    <select id="inputMode">
      <option value="manual">Manual — requirement + raw diff</option>
      <option value="githubUrl">GitHub URL — fetch diff from a public PR/commit</option>
      <option value="websiteContextUrl">Website Context — fetch page text as requirement</option>
      <option value="notionText">Notion Text — paste copied/exported Notion content</option>
    </select>
    <p class="mode-desc" id="mode-desc"></p>`;
}
