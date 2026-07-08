/**
 * Assembles the inline browser client from its focused fragments.
 *
 * The client is a single dependency-free script (no build step, no module
 * system in the browser): each fragment exports an array of source lines, and
 * `clientScript()` concatenates them and joins with newlines. The fragments are
 * layered by responsibility — state, shared render helpers, the API surface,
 * then one controller per feature, and finally the on-load event wiring.
 */
import { STATE_LINES } from './state.js';
import { RENDER_CLIENT_LINES } from './renderClient.js';
import { API_LINES } from './api.js';
import { OVERVIEW_FORMATTER_LINES } from './overviewFormatter.js';
import { NAVIGATION_LINES } from './navigationController.js';
import { WORKSPACE_LINES } from './workspaceController.js';
import { COMMAND_CENTER_LINES } from './commandCenterController.js';
import { CHAT_LINES } from './chatController.js';
import { EVENTS_LINES } from './events.js';

/** The full inline client app as a single `<script>`-ready string. */
export function clientScript(): string {
  return [
    ...STATE_LINES,
    ...RENDER_CLIENT_LINES,
    ...API_LINES,
    ...OVERVIEW_FORMATTER_LINES,
    ...NAVIGATION_LINES,
    ...WORKSPACE_LINES,
    ...COMMAND_CENTER_LINES,
    ...CHAT_LINES,
    ...EVENTS_LINES,
  ].join('\n');
}
