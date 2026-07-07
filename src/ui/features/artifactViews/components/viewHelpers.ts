/**
 * Shared presentation primitives for the artifact body views.
 *
 * Framework-free, side-effect-free string builders (escaped sections, lists,
 * paragraphs, code blocks) reused by every per-artifact view and by the card
 * assembler's Raw JSON debug view. They own no artifact metadata.
 */
import { escapeHtml } from '../../../escapeHtml.js';

export function section(title: string, bodyHtml: string): string {
  return `<section class="artifact-section"><h4>${escapeHtml(title)}</h4>${bodyHtml}</section>`;
}

export function list(items: readonly string[], emptyLabel = 'None'): string {
  if (items.length === 0) {
    return `<p class="muted">${escapeHtml(emptyLabel)}</p>`;
  }
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

export function paragraph(text: string): string {
  return `<p>${escapeHtml(text)}</p>`;
}

/** Shared code-block markup, reused for artifact bodies and the debug Raw JSON view. */
export function codeBlock(text: string): string {
  return `<pre class="code"><code>${escapeHtml(text)}</code></pre>`;
}
