/** Presentation: the "Demo Prep Loop" artifact body. */
import type {
  ApprovalQuestion,
  CodeEvidenceItem,
  DeckSlide,
  DemoPrepLoop,
  DemoStoryProposal,
  DraftVideoScript,
  LoopStatus,
  PathEvidence,
  ReadinessChecklistItem,
  ScreenshotPlanItem,
  WalkthroughStep,
} from '../../../../skills/demoPrepLoop/index.js';
import { escapeHtml } from '../../../escapeHtml.js';
import { section, list, paragraph } from './viewHelpers.js';

function tag(text: string): string {
  return `<span class="status-tag">${escapeHtml(text)}</span>`;
}

function pendingTag(): string {
  return `<span class="status-tag status-tag-pending">Pending approval</span>`;
}

/** Marks inferred locations only — confirmed ones stay untagged to reduce noise. */
function inferredTag(evidence: PathEvidence): string {
  return evidence === 'inferred' ? ` ${tag('inferred')}` : '';
}

function locationOf(filePath?: string, areaName?: string): string {
  if (filePath !== undefined) {
    return ` <span class="muted">(${escapeHtml(filePath)})</span>`;
  }
  if (areaName !== undefined) {
    return ` <span class="muted">(area: ${escapeHtml(areaName)})</span>`;
  }
  return '';
}

function labeled(label: string, text: string): string {
  return `<p class="muted"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(text)}</p>`;
}

function renderLoopStatus(s: LoopStatus): string {
  const statusTag =
    s.overallStatus === 'approved'
      ? tag(s.overallStatus)
      : `<span class="status-tag status-tag-pending">${escapeHtml(s.overallStatus)}</span>`;
  return (
    `<p>${statusTag} ${escapeHtml(s.currentStage)}</p>` +
    labeled('Next recommended action', s.nextRecommendedAction) +
    `<p class="muted"><strong>Waiting on your approval:</strong></p>${list(s.whatNeedsUserApproval)}`
  );
}

function renderStory(story: DemoStoryProposal): string {
  return (
    `<p>${pendingTag()}</p>` +
    labeled('Problem', story.problem) +
    labeled('Solution', story.solution) +
    labeled('Technical change', story.technicalChange) +
    labeled('User / product value', story.userOrProductValue) +
    labeled('Proof / demo moment', story.proofOrDemoMoment) +
    labeled('Limitations / next steps', story.limitationsOrNextSteps)
  );
}

function renderWalkthroughStep(step: WalkthroughStep): string {
  const mustShow = step.mustShow ? ` ${tag('must show')}` : '';
  return (
    `<li><strong>${escapeHtml(step.title)}</strong>${locationOf(step.filePath, step.areaName)} ` +
    `${tag(step.type)}${mustShow}${inferredTag(step.evidence)} ${pendingTag()}` +
    `<div class="muted">Why here: ${escapeHtml(step.whyThisComesHere)}</div>` +
    `<div class="muted">Show: ${escapeHtml(step.whatToShow)}</div>` +
    `<div class="muted">Say: ${escapeHtml(step.whatToSay)}</div>` +
    `<div class="muted">Skip: ${escapeHtml(step.whatToSkip)}</div>` +
    `<div class="muted">Related: ${escapeHtml(step.relatedFeatureOrConcept)} · ~${step.estimatedTimeSeconds}s</div></li>`
  );
}

function renderEvidenceItem(item: CodeEvidenceItem): string {
  return (
    `<li>${tag(item.evidenceType)}${locationOf(item.filePath, item.areaName)} ` +
    `${tag(`confidence: ${item.confidence}`)}${inferredTag(item.evidence)} ${pendingTag()}` +
    `<div class="muted">Proves: ${escapeHtml(item.whatItProves)}</div>` +
    `<div class="muted">Why it matters: ${escapeHtml(item.whyItMatters)}</div></li>`
  );
}

function renderScreenshot(shot: ScreenshotPlanItem): string {
  const where = [
    shot.filePath !== undefined ? `file: ${shot.filePath}` : undefined,
    shot.codeArea !== undefined ? `code area: ${shot.codeArea}` : undefined,
    shot.lineRange !== undefined ? `lines: ${shot.lineRange}` : undefined,
    shot.uiArea !== undefined ? `UI area: ${shot.uiArea}` : undefined,
  ].filter((part): part is string => part !== undefined);
  const whereHtml =
    where.length > 0 ? `<div class="muted">${escapeHtml(where.join(' · '))}</div>` : '';
  const mustShow = shot.mustShow ? ` ${tag('must show')}` : '';
  return (
    `<li><strong>${escapeHtml(shot.id)}</strong> — ${escapeHtml(shot.title)} ` +
    `${tag(shot.type)}${mustShow}${inferredTag(shot.evidence)} ${pendingTag()}` +
    whereHtml +
    `<div class="muted">Capture: ${escapeHtml(shot.whatToCapture)}</div>` +
    `<div class="muted">Why: ${escapeHtml(shot.whyThisMatters)}</div>` +
    `<div class="muted">Say: ${escapeHtml(shot.whatToSay)}</div>` +
    `<div class="muted">Skip: ${escapeHtml(shot.whatToSkip)}</div>` +
    `<div class="muted">Caption: ${escapeHtml(shot.suggestedCaption)} · ~${shot.estimatedTimeSeconds}s</div></li>`
  );
}

function renderQuestion(q: ApprovalQuestion): string {
  const recommended =
    q.recommendedOption !== undefined
      ? `<div class="muted">Recommended: ${escapeHtml(q.recommendedOption)}</div>`
      : '';
  return (
    `<li><strong>${escapeHtml(q.question)}</strong> ${pendingTag()}` +
    `<div class="muted">Why it matters: ${escapeHtml(q.whyItMatters)}</div>` +
    `<div class="muted">Options:</div>${list(q.options)}${recommended}</li>`
  );
}

function renderSlide(slide: DeckSlide): string {
  const shots =
    slide.screenshotIds !== undefined && slide.screenshotIds.length > 0
      ? ` <span class="muted">(screenshots: ${escapeHtml(slide.screenshotIds.join(', '))})</span>`
      : '';
  const mustHave = slide.mustHave ? ` ${tag('must have')}` : '';
  return (
    `<section class="artifact-section"><h5>Slide ${slide.slideNumber} — ${escapeHtml(slide.title)}</h5>` +
    `<p>${tag(slide.status)} ${tag(slide.visualType)}${mustHave}${shots}</p>` +
    labeled('Purpose', slide.purpose) +
    labeled('Show', slide.whatToShow) +
    `<p class="muted"><strong>On slide:</strong></p>${list(slide.onSlideText, '(no on-slide text)')}` +
    labeled('Speaker notes', slide.speakerNotes) +
    labeled('Narration script', slide.narrationScript) +
    `<div class="muted">Transition: ${escapeHtml(slide.transitionToNextSlide)} · ~${slide.estimatedTimeSeconds}s</div></section>`
  );
}

function renderVideoScript(script: DraftVideoScript): string {
  const sections = script.sections
    .map(
      (s) =>
        `<li>${tag(s.kind)} <strong>${escapeHtml(s.title)}</strong>` +
        `<div class="muted">Narration: ${escapeHtml(s.narration)}</div>` +
        `<div class="muted">Visual cue: ${escapeHtml(s.visualCue)} · ~${s.estimatedTimeSeconds}s</div></li>`,
    )
    .join('');
  return (
    `<p><strong>${escapeHtml(script.title)}</strong> <span class="muted">(${escapeHtml(script.estimatedDuration)})</span></p>` +
    `<ol>${sections}</ol>`
  );
}

function renderChecklist(items: ReadinessChecklistItem[]): string {
  if (items.length === 0) {
    return `<p class="muted">No checklist items.</p>`;
  }
  const rows = items
    .map(
      (item) =>
        `<li>${item.done ? '☑' : '☐'} ${escapeHtml(item.item)}` +
        `<div class="muted">${escapeHtml(item.why)}</div></li>`,
    )
    .join('');
  return `<ul>${rows}</ul>`;
}

export function renderDemoPrepLoop(x: DemoPrepLoop): string {
  const walkthrough =
    x.walkthroughOrder.length === 0
      ? `<p class="muted">No walkthrough steps proposed.</p>`
      : `<ol>${x.walkthroughOrder.map(renderWalkthroughStep).join('')}</ol>`;
  const evidence =
    x.codeEvidencePlan.length === 0
      ? `<p class="muted">No code evidence highlighted.</p>`
      : `<ul>${x.codeEvidencePlan.map(renderEvidenceItem).join('')}</ul>`;
  const screenshotNotice =
    `<p class="muted"><strong>Note:</strong> These screenshots are planned, not captured — ` +
    `capture each one manually before the demo.</p>`;
  const screenshots =
    x.screenshotPlan.length === 0
      ? `<p class="muted">No screenshots planned.</p>`
      : `<ul>${x.screenshotPlan.map(renderScreenshot).join('')}</ul>`;
  const questions =
    x.approvalQuestions.length === 0
      ? `<p class="muted">No open questions.</p>`
      : `<ul>${x.approvalQuestions.map(renderQuestion).join('')}</ul>`;
  const deck =
    x.deckPlan.length === 0
      ? `<p class="muted">No slides planned.</p>`
      : x.deckPlan.map(renderSlide).join('');

  return [
    section('Loop Status', renderLoopStatus(x.loopStatus)),
    section('Demo Story Proposal', renderStory(x.demoStoryProposal)),
    section('Recommended Walkthrough Order', walkthrough),
    section('Code Evidence Plan', evidence),
    section('Screenshot / Slide Plan', screenshotNotice + screenshots),
    section('Approval Questions', questions),
    section('Presentation Deck Plan', deck),
    section('Draft Video Script', renderVideoScript(x.draftVideoScript)),
    section(
      'Final Short Pitch',
      paragraph(x.finalShortPitch) + `<p class="muted">30–45 seconds, spoken.</p>`,
    ),
    section('Demo Readiness Checklist', renderChecklist(x.readinessChecklist)),
  ].join('');
}
