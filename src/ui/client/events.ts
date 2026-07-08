/**
 * Client app: DOM wiring on load.
 *
 * Connects the Run button, the "Save project context" button, the source-mode
 * selector, and the debug toggle to their controllers; renders the Project
 * Command Center (the connected-project home); then sets the initial mode
 * description and idle status.
 */
export const EVENTS_LINES: string[] = [
  "document.addEventListener('DOMContentLoaded', function () {",
  "  $('run-btn').addEventListener('click', runAnalysis);",
  "  if ($('save-context-btn')) $('save-context-btn').addEventListener('click', ccSaveContext);",
  "  $('inputMode').addEventListener('change', applyMode);",
  "  $('debug-toggle').addEventListener('change', function () { renderNav(); if (state.selected === 'rawJson' && !$('debug-toggle').checked) { selectItem('overview'); } });",
  "  applyMode();",
  "  initCommandCenter();",
  "  setStatus('idle', 'Ready when you are.');",
  "});",
];
