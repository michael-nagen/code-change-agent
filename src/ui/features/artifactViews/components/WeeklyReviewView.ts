/** Presentation: the "Weekly Review" artifact body. */
import type {
  DemoVideoStory,
  KeyDecision,
  SpecProgressItem,
  SuggestedWeeklyUpdate,
  TechnicalChangeItem,
  WeeklyBlockerOrRisk,
  WeeklyMemoryUpdateProposal,
  WeeklyReview,
  WeeklyReviewStatus,
  WhatChangedTechnically,
} from '../../../../skills/weeklyReview/index.js';
import { escapeHtml } from '../../../escapeHtml.js';
import { section, list, paragraph } from './viewHelpers.js';

function statusTag(text: string): string {
  return `<span class="status-tag">${escapeHtml(text)}</span>`;
}

function renderStatus(s: WeeklyReviewStatus): string {
  const missing =
    s.missingInputs.length > 0
      ? `<p class="muted"><strong>Missing inputs:</strong> ${escapeHtml(s.missingInputs.join(', '))}</p>`
      : `<p class="muted">All expected inputs were available.</p>`;
  return (
    `<p>${statusTag(s.status)} ${statusTag('confidence: ' + s.confidence)} ` +
    `<span class="muted">${escapeHtml(s.reviewPeriodLabel)}</span></p>` +
    missing
  );
}

function renderSpecItem(p: SpecProgressItem): string {
  return (
    `<li><strong>${escapeHtml(p.title)}</strong> — ${statusTag(p.status)} ` +
    `<span class="muted">(source: ${escapeHtml(p.source)})</span>` +
    `<div class="muted">Evidence: ${escapeHtml(p.evidence)}</div>` +
    `<div class="muted">Notes: ${escapeHtml(p.notes)}</div></li>`
  );
}

function renderTechItems(label: string, items: TechnicalChangeItem[]): string {
  if (items.length === 0) return `<h5>${escapeHtml(label)}</h5><p class="muted">None</p>`;
  const rows = items
    .map((it) => {
      const path = it.filePath !== undefined ? ` <span class="muted">(${escapeHtml(it.filePath)})</span>` : '';
      return `<li>${escapeHtml(it.description)}${path} ${statusTag(it.evidence)}</li>`;
    })
    .join('');
  return `<h5>${escapeHtml(label)}</h5><ul>${rows}</ul>`;
}

function renderTechnical(t: WhatChangedTechnically): string {
  return (
    renderTechItems('Schema / data', t.schemaOrDataChanges) +
    renderTechItems('Models / types', t.modelOrTypeChanges) +
    renderTechItems('Workflow / runtime', t.workflowOrRuntimeChanges) +
    renderTechItems('UI', t.uiChanges) +
    renderTechItems('Tools / skills added', t.toolsOrSkillsAdded) +
    `<h5>Important files / modules</h5>${list(t.importantFilesOrModules)}`
  );
}

function renderDecision(d: KeyDecision): string {
  return (
    `<li>${statusTag(d.status)} <strong>${escapeHtml(d.decision)}</strong> ` +
    `<span class="muted">(source: ${escapeHtml(d.source)})</span>` +
    `<div class="muted">Why: ${escapeHtml(d.why)}</div>` +
    `<div class="muted">Impact: ${escapeHtml(d.impact)}</div></li>`
  );
}

function renderRisk(b: WeeklyBlockerOrRisk): string {
  return (
    `<li>${statusTag(b.status)} <strong>${escapeHtml(b.title)}</strong>` +
    `<div class="muted">Why it matters: ${escapeHtml(b.whyItMatters)}</div>` +
    `<div class="muted">Next action: ${escapeHtml(b.suggestedNextAction)}</div></li>`
  );
}

function renderDemoStory(d: DemoVideoStory): string {
  const structure = d.recommendedStructure
    .map(
      (seg) =>
        `<li><strong>${escapeHtml(seg.title)}</strong> <span class="muted">(${escapeHtml(seg.durationLabel)})</span> — ${escapeHtml(seg.focus)}</li>`,
    )
    .join('');
  return (
    `<p>${escapeHtml(d.strongestStory)}</p>` +
    `<p class="muted"><strong>What to show:</strong></p>${list(d.whatToShow)}` +
    `<p class="muted"><strong>What to say:</strong></p>${list(d.whatToSay)}` +
    `<p class="muted"><strong>What to skip:</strong></p>${list(d.whatToSkip)}` +
    `<p class="muted"><strong>Recommended structure (5–7 min):</strong></p>` +
    (structure !== '' ? `<ol>${structure}</ol>` : `<p class="muted">None</p>`) +
    `<p class="muted"><strong>Key files / screens:</strong></p>${list(d.keyFilesOrScreens)}` +
    `<p class="muted"><strong>Strongest product sentence:</strong> ${escapeHtml(d.strongestProductSentence)}</p>`
  );
}

function renderWeeklyUpdate(u: SuggestedWeeklyUpdate): string {
  return (
    `<p class="muted"><strong>This week:</strong> ${escapeHtml(u.thisWeek)}</p>` +
    `<p class="muted"><strong>Technical progress:</strong> ${escapeHtml(u.technicalProgress)}</p>` +
    `<p class="muted"><strong>Demo / product progress:</strong> ${escapeHtml(u.demoProductProgress)}</p>` +
    `<p class="muted"><strong>Blockers:</strong> ${escapeHtml(u.blockers)}</p>` +
    `<p class="muted"><strong>Next week:</strong> ${escapeHtml(u.nextWeek)}</p>`
  );
}

function renderMemoryProposal(m: WeeklyMemoryUpdateProposal): string {
  const statuses = m.updatedChecklistStatuses.map((c) => `${c.item}: ${c.status}`);
  return (
    `<p>${escapeHtml(m.latestWeeklySummary)}</p>` +
    `<p class="muted"><strong>Updated checklist statuses:</strong></p>${list(statuses)}` +
    `<p class="muted"><strong>New decisions:</strong></p>${list(m.newDecisions)}` +
    `<p class="muted"><strong>Updated blockers:</strong></p>${list(m.updatedBlockers)}` +
    `<p class="muted"><strong>Next actions:</strong></p>${list(m.nextActions)}` +
    `<p class="muted"><strong>Demo story summary:</strong> ${escapeHtml(m.demoStorySummary)}</p>` +
    `<p class="muted"><strong>Files worth showing:</strong></p>${list(m.filesWorthShowing)}`
  );
}

export function renderWeeklyReview(r: WeeklyReview): string {
  const spec =
    r.progressAgainstSpec.length === 0
      ? `<p class="muted">None</p>`
      : `<ul>${r.progressAgainstSpec.map(renderSpecItem).join('')}</ul>`;
  const decisions =
    r.keyDecisions.length === 0
      ? `<p class="muted">No decisions recorded.</p>`
      : `<ul>${r.keyDecisions.map(renderDecision).join('')}</ul>`;
  const risks =
    r.blockersAndRisks.length === 0
      ? `<p class="muted">No blockers or risks.</p>`
      : `<ul>${r.blockersAndRisks.map(renderRisk).join('')}</ul>`;

  return [
    section('Weekly Review Status', renderStatus(r.status)),
    section('Executive Summary', paragraph(r.executiveSummary)),
    section('Progress Against Spec', spec),
    section('What Changed Technically', renderTechnical(r.whatChangedTechnically)),
    section('Key Decisions', decisions),
    section('Blockers / Risks', risks),
    section('Demo / Video Story', renderDemoStory(r.demoVideoStory)),
    section('Review Talking Points', list(r.reviewTalkingPoints)),
    section('Suggested Weekly Update', renderWeeklyUpdate(r.suggestedWeeklyUpdate)),
    section('Next Week Plan', list(r.nextWeekPlan)),
    section('Memory Update Proposal', renderMemoryProposal(r.memoryUpdateProposal)),
  ].join('');
}
