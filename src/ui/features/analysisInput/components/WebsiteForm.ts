/** Presentation: the Website Context source form. Hidden until selected. */
export function websiteForm(): string {
  return `    <div class="field-group hidden" id="group-websiteContextUrl" data-mode-group="websiteContextUrl">
      <p class="note">Website URL provides requirement/context only. It does not provide a code diff — you still need to paste the diff below.</p>
      <label for="websiteUrl">Website / documentation / spec URL</label>
      <input type="text" id="websiteUrl" placeholder="https://example.com/product/spec" />
      <div style="height:12px"></div>
      <label for="ws_rawDiff">Raw diff</label>
      <textarea id="ws_rawDiff" class="mono" rows="10" placeholder="Paste a unified git diff…"></textarea>
    </div>`;
}
