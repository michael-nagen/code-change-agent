/** Composes the app header and the mode banner into the page's top section. */
import type { UiMode } from '../../types.js';
import { appHeader } from './components/AppHeader.js';
import { modeBanner } from './components/ModeBanner.js';

/** App header block plus the mode banner, indented for the page <div class="wrap">. */
export function appShell(mode: UiMode): string {
  return `${appHeader()}
  ${modeBanner(mode)}`;
}
