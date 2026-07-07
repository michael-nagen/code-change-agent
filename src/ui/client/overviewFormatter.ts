/**
 * Client app: presentation copy for the Overview panel.
 *
 * Keeps the readiness → guidance wording out of the rendering code, so
 * `renderOverview` just asks for the line and appends it. Formatting (what the
 * text says) lives here; layout (how it's placed) lives in the controller.
 */
export const OVERVIEW_FORMATTER_LINES: string[] = [
  "function overviewGuidance(readiness) {",
  "  var guide = { ready: 'Looks ready. Generate a PR Draft and open your pull request.', needs_changes: 'Some gaps remain. Review PR Readiness, then generate a PR Draft.', blocked: 'A critical requirement is unmet. Address it before opening a PR.', unclear: 'Review the analysis, then generate outputs when you are ready.' };",
  "  return guide[readiness] || guide.unclear;",
  "}",
  "",
];
