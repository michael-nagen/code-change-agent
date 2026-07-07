/**
 * Presentation: the status card — a live status region (idle/loading/success/
 * error) plus the "Show debug data" toggle that reveals the Raw JSON nav item.
 */
export function statusSection(): string {
  return `  <div class="card">
    <h2>Status</h2>
    <div id="status" class="status status-idle">Ready when you are.</div>
    <div class="debug-row">
      <input type="checkbox" id="debug-toggle" style="width:auto" />
      <label for="debug-toggle" style="margin:0">Show debug data (Raw JSON)</label>
    </div>
  </div>`;
}
