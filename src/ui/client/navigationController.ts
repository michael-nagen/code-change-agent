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
  "  nav.appendChild(navItem('overview', 'Overview'));",
  "  nav.appendChild(navGroupTitle('Base analysis'));",
  "  for (var i = 0; i < BASE.length; i++) nav.appendChild(navItem(BASE[i][0], BASE[i][1]));",
  "  nav.appendChild(navGroupTitle('Generated outputs'));",
  "  for (var k = 0; k < OUTPUTS.length; k++) nav.appendChild(navItem(OUTPUTS[k][0], OUTPUTS[k][1]));",
  "  if ($('debug-toggle').checked) { nav.appendChild(navGroupTitle('Developer')); nav.appendChild(navItem('rawJson', 'Raw JSON')); }",
  "}",
  "",
  "function navGroupTitle(text) { return el('div', 'nav-group-title', text); }",
  "function navItem(id, label) {",
  "  var b = el('button', 'nav-item', null); b.type = 'button';",
  "  var grp = GROUP_OF[id]; if (grp) b.classList.add('group-' + grp);",
  "  if (id === state.selected) b.classList.add('active');",
  "  b.appendChild(el('span', null, label));",
  "  if (id !== 'overview') b.appendChild(chipFor(id));",
  "  b.addEventListener('click', function () { selectItem(id); });",
  "  return b;",
  "}",
  "",
  "function selectItem(id) { state.selected = id; state.chatLoading = false; renderNav(); renderPanel(); renderChat(); }",
  "",
];
