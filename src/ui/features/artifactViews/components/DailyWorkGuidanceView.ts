/** Presentation: the "Daily Work Guidance" artifact body. */
import type {
  AdvancedChecklistItem,
  ApprovalStatus,
  BlockerOrRisk,
  DailyWorkGuidance,
  DecisionNeedingApproval,
  GuidanceLoopStatus,
  GuidanceSelfCritique,
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

const APPROVAL_TAGS: Record<ApprovalStatus, { css: string; label: string }> = {
  pending_approval: { css: 'status-tag-pending', label: 'Pending approval' },
  approved: { css: 'status-tag-approved', label: 'Approved' },
  rejected: { css: 'status-tag-rejected', label: 'Rejected' },
  edited: { css: 'status-tag-edited', label: 'Edited' },
  deferred: { css: 'status-tag-deferred', label: 'Deferred' },
};

function approvalTag(status: ApprovalStatus): string {
  const tag = APPROVAL_TAGS[status];
  return `<span class="status-tag ${tag.css}">${escapeHtml(tag.label)}</span>`;
}

/** The per-item action picker rendered only while the item awaits a decision. */
function decisionControls(itemId: string): string {
  return (
    `<div class="decision-controls" data-decision-item="${escapeHtml(itemId)}">` +
    `<select data-decision-action>` +
    `<option value="">No decision</option>` +
    `<option value="approve">Approve</option>` +
    `<option value="reject">Reject</option>` +
    `<option value="edit">Edit</option>` +
    `<option value="defer">Defer</option>` +
    `</select>` +
    `<input type="text" data-decision-edited placeholder="Edited text (used with Edit)"/>` +
    `<input type="text" data-decision-note placeholder="Note / reason (optional)"/>` +
    `</div>`
  );
}

function noteLine(note?: string): string {
  return note !== undefined ? `<div class="muted">Your note: ${escapeHtml(note)}</div>` : '';
}

function renderLoopStatus(loop: GuidanceLoopStatus): string {
  const stageTag =
    loop.currentStage === 'approved_plan'
      ? `<span class="status-tag status-tag-approved">${escapeHtml(loop.currentStage)}</span>`
      : `<span class="status-tag status-tag-pending">${escapeHtml(loop.currentStage)}</span>`;
  const decided =
    loop.decidedAt !== undefined
      ? `<p class="muted">Last decisions applied: ${escapeHtml(loop.decidedAt)}</p>`
      : '';
  // `lastRevisionSummary` is set only by the model-in-the-loop merge, so its
  // presence is the exact signal that re-planning ran on this artifact.
  const replanBanner =
    loop.lastRevisionSummary !== undefined
      ? `<div class="replan-banner">` +
        `<strong>Model re-planning ran.</strong> The agent revised only the steps you rejected or edited ` +
        `and returned them below as pending approval — approved and deferred items were preserved unchanged.` +
        `<div class="muted">Revision summary: ${escapeHtml(loop.lastRevisionSummary)}</div>` +
        `</div>`
      : '';
  return (
    `<p>Stage: ${stageTag} · Overall: ${statusTag(loop.overallStatus)}</p>` +
    `<p class="muted">Recommendations are not final until you act: pick Approve / Reject / Edit / Defer per item below, then click Apply decisions. Rejecting or editing a step makes the agent re-plan it for your approval.</p>` +
    replanBanner +
    decided
  );
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

function renderDecision(d: DecisionNeedingApproval, index: number): string {
  const options =
    d.options !== undefined && d.options.length > 0
      ? `<div class="muted">Options: ${escapeHtml(d.options.join(', '))}</div>`
      : '';
  const recommended =
    d.recommendedOption !== undefined
      ? `<div class="muted">Recommended: ${escapeHtml(d.recommendedOption)}</div>`
      : '';
  const controls = d.status === 'pending_approval' ? decisionControls(`decision-${index + 1}`) : '';
  return (
    `<li>${approvalTag(d.status)} <strong>${escapeHtml(d.decision)}</strong>` +
    `<div class="muted">Context: ${escapeHtml(d.context)}</div>${options}${recommended}` +
    `${noteLine(d.note)}${controls}</li>`
  );
}

function renderPlannedStep(s: PlannedStep): string {
  const related =
    s.relatedSpecItems !== undefined && s.relatedSpecItems.length > 0
      ? `<p class="muted"><strong>Related spec items:</strong> ${escapeHtml(s.relatedSpecItems.join(', '))}</p>`
      : '';
  const controls = s.status === 'pending_approval' ? decisionControls(s.id) : '';
  const respondsTo =
    s.respondsTo !== undefined
      ? `<div class="muted">Re-planned from your feedback on: ${escapeHtml(s.respondsTo)}</div>`
      : '';
  return (
    `<section class="artifact-section">` +
    `<h5>${escapeHtml(s.id)}: ${escapeHtml(s.title)} ${approvalTag(s.status)}</h5>` +
    `${respondsTo}${noteLine(s.note)}` +
    `<p class="muted"><strong>Why it matters:</strong> ${escapeHtml(s.whyItMatters)}</p>` +
    `<p class="muted"><strong>Expected output:</strong> ${escapeHtml(s.expectedOutput)}</p>` +
    related +
    `<p class="muted"><strong>Validation checklist:</strong></p>${list(s.validationChecklist)}` +
    `<p class="muted"><strong>Cursor / Claude prompt:</strong></p>${codeBlock(s.cursorPrompt)}` +
    controls +
    `</section>`
  );
}

function renderSelfCritique(critique: GuidanceSelfCritique): string {
  const verdict = critique.revisionApplied
    ? `<span class="status-tag status-tag-edited">Plan revised once before showing you</span>`
    : `<span class="status-tag">No revision needed</span>`;
  const issues =
    critique.issues.length === 0
      ? `<p class="muted">No issues found.</p>`
      : `<ul>${critique.issues
          .map(
            (issue) =>
              `<li>${statusTag(issue.severity)}${
                issue.targetStepId !== undefined
                  ? ` <span class="muted">(${escapeHtml(issue.targetStepId)})</span>`
                  : ''
              } ${escapeHtml(issue.issue)}` +
              `<div class="muted">Suggestion: ${escapeHtml(issue.suggestion)}</div></li>`,
          )
          .join('')}</ul>`;
  return (
    `<p>${verdict} <span class="muted">(confidence: ${escapeHtml(critique.confidence)} · checked ${escapeHtml(critique.checkedAt)})</span></p>` +
    `<p>${escapeHtml(critique.summary)}</p>` +
    issues
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
      : `<ul>${g.decisionsNeedingApproval.map((d, index) => renderDecision(d, index)).join('')}</ul>`;
  const steps =
    g.plannedSteps.length === 0
      ? `<p class="muted">No steps proposed.</p>`
      : g.plannedSteps.map(renderPlannedStep).join('');

  const selfCritique =
    g.selfCritique !== undefined
      ? [section('Plan Self-Review', renderSelfCritique(g.selfCritique))]
      : [];

  return [
    section('Loop Status', renderLoopStatus(g.loopStatus)),
    ...selfCritique,
    section('Yesterday Summary', paragraph(g.yesterdaySummary)),
    section('Progress vs Spec', progress),
    section('Advanced Checklist Items', advanced),
    section('Blockers / Risks', blockers),
    section('Decisions Needing Approval', decisions),
    section("Today's Planned Steps (yours to approve)", steps),
    section(
      'Notion Daily Update',
      codeBlock(notionDailyUpdateToMarkdown({ update: g.notionDailyUpdate, date: g.memoryUpdate.date })),
    ),
    section('Memory Update', renderMemory(g.memoryUpdate)),
  ].join('');
}
