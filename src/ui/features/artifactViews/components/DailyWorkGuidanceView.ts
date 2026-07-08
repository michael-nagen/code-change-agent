/** Presentation: the "Daily Work Guidance" artifact body — a short checkpoint. */
import type { DailyWorkGuidance } from '../../../../skills/dailyWorkGuidance/index.js';
import { section, list, paragraph } from './viewHelpers.js';

/**
 * Renders the lean checkpoint: a one-line headline, what changed, what to do
 * next, and only the important blockers/decisions. The full artifact is edited
 * through the companion chat, and the footer offers Save to memory / Send to
 * Notion — so there are deliberately no per-section copy or decision controls.
 */
export function renderDailyWorkGuidance(g: DailyWorkGuidance): string {
  return [
    section('Where things stand', paragraph(g.headline)),
    section('What we did', list(g.whatChanged, 'Nothing recorded.')),
    section('What to do next', list(g.nextActions, 'No next actions.')),
    section(
      'Blockers / decisions',
      g.blockersOrDecisions.length === 0
        ? `<p class="muted">Nothing important to flag.</p>`
        : list(g.blockersOrDecisions),
    ),
  ].join('');
}
