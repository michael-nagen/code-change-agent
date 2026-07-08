/**
 * Client app: the left navigation controller.
 *
 * Owns selected-item behavior and the nav rendering — the Overview / Base
 * analysis / Generated outputs / (debug) Raw JSON items, each with a status
 * chip. Selecting an item updates `state.selected` and re-renders the nav,
 * panel, and chat.
 */
export const NAVIGATION_LINES: string[] = [
  "function renderNav() {",
  "  var nav = $('nav');",
  "  nav.innerHTML = '';",
  "  for (var s = 0; s < NAV_SECTIONS.length; s++) {",
  "    var sec = NAV_SECTIONS[s];",
  "    if (sec.title) nav.appendChild(navGroupTitle(sec.title));",
  "    for (var i = 0; i < sec.ids.length; i++) nav.appendChild(navItem(sec.ids[i], labelOf(sec.ids[i])));",
  "  }",
  "  if ($('debug-toggle').checked) { nav.appendChild(navGroupTitle('Developer')); nav.appendChild(navItem('rawJson', 'Raw JSON')); }",
  "  renderCompanionStatus();",
  "}",
  "",
  "function navGroupTitle(text) { return el('div', 'nav-group-title', text); }",
  "function navItem(id, label) {",
  "  var b = el('button', 'nav-item', null); b.type = 'button';",
  "  var grp = GROUP_OF[id]; if (grp) b.classList.add('group-' + grp);",
  "  if (id === state.selected) b.classList.add('active');",
  "  b.appendChild(el('span', null, label));",
  "  // Only real artifacts (and Raw JSON) carry a generated/not-generated chip.",
  "  if (GROUP_OF[id] || id === 'rawJson') b.appendChild(chipFor(id));",
  "  b.addEventListener('click', function () { selectItem(id); });",
  "  return b;",
  "}",
  "",
  "function selectItem(id) { state.selected = id; state.chatLoading = false; state.memoryEditing = false; renderNav(); renderPanel(); renderChat(); }",
  "",
];
