/**
 * Client app: DOM wiring on load.
 *
 * Connects the Run button, the source-mode selector, and the debug toggle to
 * their controllers, then sets the initial mode description and idle status.
 */
export const EVENTS_LINES: string[] = [
  "document.addEventListener('DOMContentLoaded', function () {",
  "  $('run-btn').addEventListener('click', runAnalysis);",
  "  $('inputMode').addEventListener('change', applyMode);",
  "  $('debug-toggle').addEventListener('change', function () { renderNav(); if (state.selected === 'rawJson' && !$('debug-toggle').checked) { selectItem('overview'); } });",
  "  applyMode();",
  "  setStatus('idle', 'Ready when you are.');",
  "});",
];
