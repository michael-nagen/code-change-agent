/** Presentation: the "Daily Work Guidance" artifact body. */
import type {
  AdvancedChecklistItem,
  BlockerOrRisk,
  DailyWorkGuidance,
  DecisionNeedingApproval,
  MemoryUpdate,
  PlannedStep,
  ProgressItem,
} from '../../../../skills/dailyWorkGuidance/index.js';
import { escapeHtml } from '../../../escapeHtml.js';
import { notionDailyUpdateToMarkdown } from '../model/copyFormatters.js';
import { section, list, paragraph, codeBlock } from './viewHelpers.js';

function statusTag(status: string): string {
  return `<span class="status-tag">${escapeHtml(status)}</span>`;
}

function approvalTag(): string {
  return '<span class="status-tag status-tag-pending">Pending approval</span>';
}

function renderProgressItem(p: ProgressItem): string {
  const arrow = p.previousStatus !== undefined ? `${escapeHtml(p.previousStatus)} &rarr; ` : '';
  return (
    `<li><strong>${escapeHtml(p.item)}</strong> — ${arrow}${statusTag(p.newStatus)} ` +
    `<span class="muted">(confidence: ${escapeHtml(p.confidence)})</span>` +
    `<div class="muted">Changed: ${escapeHtml(p.whatChanged)}</div>` +
    `<div class="muted">Evidence: ${escapeHtml(p.evidence)}</div></li>`
  );
}

function renderAdvancedItem(a: AdvancedChecklistItem): string {
  return (
    `<li><strong>${escapeHtml(a.item)}</strong> — ${escapeHtml(a.previousStatus)} &rarr; ` +
    `${statusTag(a.newStatus)}<div class="muted">${escapeHtml(a.whatAdvanced)}</div>` +
    `<div class="muted">Evidence: ${escapeHtml(a.evidence)}</div></li>`
  );
}

function renderBlocker(b: BlockerOrRisk): string {
  const sev = b.severity !== undefined ? ` ${statusTag(b.severity)}` : '';
  return (
    `<li><strong>${escapeHtml(b.title)}</strong>${sev}` +
    `<div>${escapeHtml(b.description)}</div>` +
    `<div class="muted">Why it matters: ${escapeHtml(b.whyItMatters)}</div>` +
    `<div class="muted">Required action: ${escapeHtml(b.requiredAction)}</div></li>`
  );
}

function renderDecision(d: DecisionNeedingApproval): string {
  const options =
    d.options !== undefined && d.options.length > 0
      ? `<div class="muted">Options: ${escapeHtml(d.options.join(', '))}</div>`
      : '';
  const recommended =
    d.recommendedOption !== undefined
      ? `<div class="muted">Recommended: ${escapeHtml(d.recommendedOption)}</div>`
      : '';
  return (
    `<li>${approvalTag()} <strong>${escapeHtml(d.decision)}</strong>` +
    `<div class="muted">Context: ${escapeHtml(d.context)}</div>${options}${recommended}</li>`
  );
}

function renderPlannedStep(s: PlannedStep): string {
  const related =
    s.relatedSpecItems !== undefined && s.relatedSpecItems.length > 0
      ? `<p class="muted"><strong>Related spec items:</strong> ${escapeHtml(s.relatedSpecItems.join(', '))}</p>`
      : '';
  return (
    `<section class="artifact-section">` +
    `<h5>${escapeHtml(s.id)}: ${escapeHtml(s.title)} ${approvalTag()}</h5>` +
    `<p class="muted"><strong>Why it matters:</strong> ${escapeHtml(s.whyItMatters)}</p>` +
    `<p class="muted"><strong>Expected output:</strong> ${escapeHtml(s.expectedOutput)}</p>` +
    related +
    `<p class="muted"><strong>Validation checklist:</strong></p>${list(s.validationChecklist)}` +
    `<p class="muted"><strong>Cursor / Claude prompt:</strong></p>${codeBlock(s.cursorPrompt)}` +
    `</section>`
  );
}

function renderMemory(m: MemoryUpdate): string {
  const statuses = m.updatedChecklistStatuses.map((c) => `${c.item}: ${c.status}`);
  return (
    `<p class="muted"><strong>Date:</strong> ${escapeHtml(m.date)}</p>` +
    `<p>${escapeHtml(m.dailySummary)}</p>` +
    `<p class="muted"><strong>Updated checklist statuses:</strong></p>${list(statuses)}` +
    `<p class="muted"><strong>New decisions:</strong></p>${list(m.newDecisions)}` +
    `<p class="muted"><strong>Open blockers:</strong></p>${list(m.openBlockers)}` +
    `<p class="muted"><strong>Next actions:</strong></p>${list(m.nextActions)}`
  );
}

export function renderDailyWorkGuidance(g: DailyWorkGuidance): string {
  const progress =
    g.progressVsSpec.length === 0
      ? `<p class="muted">None</p>`
      : `<ul>${g.progressVsSpec.map(renderProgressItem).join('')}</ul>`;
  const advanced =
    g.advancedChecklistItems.length === 0
      ? `<p class="muted">Nothing advanced.</p>`
      : `<ul>${g.advancedChecklistItems.map(renderAdvancedItem).join('')}</ul>`;
  const blockers =
    g.blockersAndRisks.length === 0
      ? `<p class="muted">No known blockers or risks.</p>`
      : `<ul>${g.blockersAndRisks.map(renderBlocker).join('')}</ul>`;
  const decisions =
    g.decisionsNeedingApproval.length === 0
      ? `<p class="muted">No decisions need approval.</p>`
      : `<ul>${g.decisionsNeedingApproval.map(renderDecision).join('')}</ul>`;
  const steps =
    g.plannedSteps.length === 0
      ? `<p class="muted">No steps proposed.</p>`
      : g.plannedSteps.map(renderPlannedStep).join('');

  return [
    section('Yesterday Summary', paragraph(g.yesterdaySummary)),
    section('Progress vs Spec', progress),
    section('Advanced Checklist Items', advanced),
    section('Blockers / Risks', blockers),
    section('Decisions Needing Approval', decisions),
    section("Today's Planned Steps (all pending approval)", steps),
    section(
      'Notion Daily Update',
      codeBlock(notionDailyUpdateToMarkdown({ update: g.notionDailyUpdate, date: g.memoryUpdate.date })),
    ),
    section('Memory Update', renderMemory(g.memoryUpdate)),
  ].join('');
}
