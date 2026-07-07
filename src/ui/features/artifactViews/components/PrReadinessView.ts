/** Presentation: the "PR Readiness" (GapReport) artifact body. */
import type { GapReport } from '../../../../skills/gapReport/index.js';
import { escapeHtml } from '../../../escapeHtml.js';
import { section, list, paragraph } from './viewHelpers.js';

export function renderGapReport(gap: GapReport): string {
  return [
    `<p class="badge badge-${escapeHtml(gap.readiness)}">${escapeHtml(gap.readiness)}</p>`,
    paragraph(gap.prRecommendation),
    section('Completed Work', list(gap.completedWork)),
    section('Remaining Gaps', list(gap.remainingGaps)),
    section('Partial Items', list(gap.partialItems)),
    section('Unclear Items', list(gap.unclearItems)),
    section('Risks', list(gap.risks)),
    section('Recommended Next Actions', list(gap.recommendedNextActions)),
  ].join('');
}
