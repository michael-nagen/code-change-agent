/** Presentation: the "Requirement Check" (RequirementAlignment) artifact body. */
import type { RequirementAlignment } from '../../../../skills/requirementAlignment/index.js';
import { escapeHtml } from '../../../escapeHtml.js';
import { section, list, paragraph } from './viewHelpers.js';

export function renderRequirementAlignment(ra: RequirementAlignment): string {
  return [
    section('Requirement Summary', paragraph(ra.requirementSummary)),
    section(
      'Overall Assessment',
      `${paragraph(ra.overallAssessment)}<p class="muted">Confidence: ${escapeHtml(ra.confidence)}</p>`,
    ),
    section('Satisfied', list(ra.satisfiedItems)),
    section('Partially Satisfied', list(ra.partiallySatisfiedItems)),
    section('Missing', list(ra.missingItems)),
    section('Unclear', list(ra.unclearItems)),
  ].join('');
}
