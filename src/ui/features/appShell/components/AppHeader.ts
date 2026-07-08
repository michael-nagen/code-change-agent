/**
 * Presentation: the product header — the Developer Work Companion brand, its
 * one-line promise, and a client-filled status strip (mode / project / loop
 * stage / memory). The secondary line keeps the original "what you do here"
 * description so the flow from input → analysis → outputs stays legible.
 */
export function appHeader(): string {
  return `  <div class="app-header">
    <h1>Developer Work Companion</h1>
    <p class="app-tagline">Analyze code work, plan the next step, approve/revise the plan, and carry memory forward.</p>
    <p class="muted app-subtle">Upload a change, add the requirement, and turn the analysis into PR notes, flows, and team updates.</p>
    <div id="companion-status" class="companion-status"></div>
  </div>`;
}
