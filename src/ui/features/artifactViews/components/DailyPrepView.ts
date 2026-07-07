/** Presentation: the "Daily Prep" (DailyUpdate) artifact body. */
import type { DailyUpdate } from '../../../../skills/dailyUpdate/index.js';
import { escapeHtml } from '../../../escapeHtml.js';
import { section, list, paragraph } from './viewHelpers.js';

export function renderDailyUpdate(du: DailyUpdate): string {
  const topic =
    `<section class="artifact-section"><h5>${escapeHtml(du.highlightedTopic.title)}</h5>` +
    `<p>${escapeHtml(du.highlightedTopic.explanation)}</p>` +
    `<p class="muted"><strong>Why it matters:</strong> ${escapeHtml(du.highlightedTopic.whyItMatters)}</p></section>`;
  return [
    section('Headline', paragraph(du.headline)),
    section('Yesterday', list(du.yesterdaySummary)),
    section('Today', list(du.todaySuggestions)),
    section('Blockers / Risks', list(du.blockersOrRisks)),
    section('Highlighted Topic', topic),
    section('Spoken Version', paragraph(du.spokenVersion)),
  ].join('');
}
