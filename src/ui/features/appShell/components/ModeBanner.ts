/**
 * Presentation: the honest mode banner that makes clear whether the page is
 * backed by the real engine or clearly-labeled demo data.
 */
import type { UiMode } from '../../../types.js';

export function modeBanner(mode: UiMode): string {
  if (mode === 'mock') {
    return `<div class="banner banner-mock" id="mode-banner">DEMO / MOCK MODE — output is fake placeholder data, NOT real AI output.</div>`;
  }
  return `<div class="banner banner-real" id="mode-banner">REAL ENGINE MODE — calls the live analysis engine.</div>`;
}
