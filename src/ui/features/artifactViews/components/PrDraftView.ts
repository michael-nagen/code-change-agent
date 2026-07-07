/** Presentation: the "PR Draft" (PRDescription) artifact body. */
import type { PRDescription } from '../../../../skills/prDescription/index.js';
import { codeBlock } from './viewHelpers.js';
import { prDescriptionToMarkdown } from '../model/copyFormatters.js';

export function renderPrDescription(pr: PRDescription): string {
  // Copy is handled by the card's "Copy PR Draft" button (via copyText); the
  // body just shows the clean markdown for reading.
  return codeBlock(prDescriptionToMarkdown(pr));
}
