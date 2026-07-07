/**
 * Client app: shared DOM + render helpers used across every controller.
 *
 * This is the render-orchestration layer: the `$` lookup, the `el` element
 * builder, the status banner + loading ticker, the source-mode toggle, and the
 * status/chip derivation that the nav, panel, overview, and tiles all reuse.
 * Feature controllers depend on these helpers; this file depends on none of
 * them.
 */
export const RENDER_CLIENT_LINES: string[] = [
  "var $ = function (id) { return document.getElementById(id); };",
  "",
  "function currentMode() { return $('inputMode').value; }",
  "function applyMode() {",
  "  var mode = currentMode();",
  "  for (var i = 0; i < MODES.length; i++) { var g = $('group-' + MODES[i]); if (g) g.classList.toggle('hidden', MODES[i] !== mode); }",
  "  $('mode-desc').textContent = MODE_DESC[mode] || '';",
  "}",
  "",
  "function setStatus(kind, text) { var el = $('status'); el.className = 'status status-' + kind; el.textContent = text; }",
  "function startLoading() { var i = 0; setStatus('loading', LOADING_STEPS[0]); loadingTimer = setInterval(function () { i = (i + 1) % LOADING_STEPS.length; setStatus('loading', LOADING_STEPS[i]); }, 2500); }",
  "function stopLoading() { if (loadingTimer) { clearInterval(loadingTimer); loadingTimer = null; } }",
  "",
  "function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }",
  "",
  "function statusOf(id) {",
  "  if (state.override[id]) return state.override[id];",
  "  var c = state.cards[id];",
  "  if (!c) return 'not_generated';",
  "  return c.state;",
  "}",
  "",
  "function chipFor(id) {",
  "  var s = statusOf(id);",
  "  return el('span', 'chip chip-' + s, STATUS_LABELS[s] || s);",
  "}",
  "",
];
