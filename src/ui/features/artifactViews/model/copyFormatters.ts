/**
 * Plain-text/markdown formatters for copyable artifacts.
 *
 * These turn a structured artifact into a clean, ready-to-paste document. They
 * are separate from the HTML body views so copy formatting never gets tangled
 * up with layout markup.
 */
import type { PRDescription } from '../../../../skills/prDescription/index.js';
import type {
  DailyWorkGuidance,
  NotionDailyUpdate,
} from '../../../../skills/dailyWorkGuidance/index.js';
import type {
  SchemaChangeItem,
  TechnicalChangeBrief,
} from '../../../../skills/technicalChangeBrief/index.js';
import type { DemoPrepLoop } from '../../../../skills/demoPrepLoop/index.js';
import type { WeeklyReview } from '../../../../skills/weeklyReview/index.js';

/** Assemble the PR description as a single copyable markdown document. */
export function prDescriptionToMarkdown(pr: PRDescription): string {
  const lines: string[] = [];
  lines.push(`# ${pr.title}`, '', pr.summary, '');
  lines.push('## What changed');
  for (const item of pr.whatChanged) lines.push(`- ${item}`);
  lines.push('', '## Requirement coverage');
  for (const item of pr.requirementCoverage) lines.push(`- ${item}`);
  lines.push('', '## Feature flow', '', pr.featureFlow, '');
  lines.push('## Testing notes');
  for (const item of pr.testingNotes) lines.push(`- ${item}`);
  lines.push('', '## Risks and follow-ups');
  for (const item of pr.risksAndFollowUps) lines.push(`- ${item}`);
  return lines.join('\n');
}

/**
 * The fixed Notion-ready daily update block. This is the copyable format the
 * developer pastes into Notion: a small, stable set of headed sections.
 */
export function notionDailyUpdateToMarkdown({
  update,
  date,
}: {
  update: NotionDailyUpdate;
  date: string;
}): string {
  return [
    `## Daily Update — ${date}`,
    '',
    '### Yesterday',
    update.yesterday,
    '',
    '### Today',
    update.today,
    '',
    '### Blockers',
    update.blockers,
    '',
    '### Decisions needed',
    update.decisionsNeeded,
    '',
    '### Progress vs spec',
    update.progressVsSpec,
    '',
    '### Next Cursor prompt',
    update.nextCursorPrompt,
  ].join('\n');
}

/** Assemble the full Daily Work Guidance artifact as a copyable markdown document. */
export function dailyWorkGuidanceToMarkdown(g: DailyWorkGuidance): string {
  const lines: string[] = [];
  lines.push(`# Daily Work Guidance — ${g.memoryUpdate.date}`, '');
  lines.push(`Loop: ${g.loopStatus.currentStage} (${g.loopStatus.overallStatus})`, '');

  if (g.selfCritique !== undefined) {
    lines.push('## Plan self-review');
    lines.push(
      `${g.selfCritique.revisionApplied ? 'Plan revised once before review.' : 'No revision needed.'} (confidence: ${g.selfCritique.confidence})`,
    );
    lines.push(g.selfCritique.summary);
    for (const issue of g.selfCritique.issues) {
      const target = issue.targetStepId !== undefined ? ` (${issue.targetStepId})` : '';
      lines.push(`- [${issue.severity}]${target} ${issue.issue} — ${issue.suggestion}`);
    }
    lines.push('');
  }

  lines.push('## Yesterday', '', g.yesterdaySummary, '');

  lines.push('## Progress vs spec');
  for (const p of g.progressVsSpec) {
    const prev = p.previousStatus !== undefined ? `${p.previousStatus} → ` : '';
    lines.push(`- ${p.item}: ${prev}${p.newStatus} (confidence: ${p.confidence})`);
    lines.push(`  - Changed: ${p.whatChanged}`);
    lines.push(`  - Evidence: ${p.evidence}`);
  }
  lines.push('');

  lines.push('## Advanced yesterday');
  if (g.advancedChecklistItems.length === 0) lines.push('- None');
  for (const a of g.advancedChecklistItems) {
    lines.push(`- ${a.item}: ${a.previousStatus} → ${a.newStatus} — ${a.whatAdvanced}`);
  }
  lines.push('');

  lines.push('## Blockers and risks');
  if (g.blockersAndRisks.length === 0) lines.push('- None');
  for (const b of g.blockersAndRisks) {
    const sev = b.severity !== undefined ? ` [${b.severity}]` : '';
    lines.push(`- ${b.title}${sev}: ${b.description}`);
    lines.push(`  - Why it matters: ${b.whyItMatters}`);
    lines.push(`  - Required action: ${b.requiredAction}`);
  }
  lines.push('');

  lines.push('## Decisions needing approval');
  if (g.decisionsNeedingApproval.length === 0) lines.push('- None');
  for (const d of g.decisionsNeedingApproval) {
    lines.push(`- [${d.status}] ${d.decision}`);
    lines.push(`  - Context: ${d.context}`);
    if (d.options !== undefined && d.options.length > 0) {
      lines.push(`  - Options: ${d.options.join(', ')}`);
    }
    if (d.recommendedOption !== undefined) {
      lines.push(`  - Recommended: ${d.recommendedOption}`);
    }
  }
  lines.push('');

  lines.push("## Today's planned steps");
  for (const s of g.plannedSteps) {
    lines.push(`### ${s.id}: ${s.title} [${s.status}]`);
    lines.push(`- Why it matters: ${s.whyItMatters}`);
    lines.push(`- Expected output: ${s.expectedOutput}`);
    if (s.relatedSpecItems !== undefined && s.relatedSpecItems.length > 0) {
      lines.push(`- Related spec items: ${s.relatedSpecItems.join(', ')}`);
    }
    lines.push('- Validation:');
    for (const v of s.validationChecklist) lines.push(`  - ${v}`);
    lines.push('- Cursor/Claude prompt:', '```', s.cursorPrompt, '```');
  }
  lines.push('');

  lines.push(
    '## Notion daily update',
    '',
    notionDailyUpdateToMarkdown({ update: g.notionDailyUpdate, date: g.memoryUpdate.date }),
    '',
  );

  lines.push('## Memory update', '', `- Date: ${g.memoryUpdate.date}`, `- Summary: ${g.memoryUpdate.dailySummary}`);
  lines.push('- Checklist statuses:');
  for (const c of g.memoryUpdate.updatedChecklistStatuses) lines.push(`  - ${c.item}: ${c.status}`);
  lines.push('- New decisions:');
  for (const nd of g.memoryUpdate.newDecisions) lines.push(`  - ${nd}`);
  lines.push('- Open blockers:');
  for (const ob of g.memoryUpdate.openBlockers) lines.push(`  - ${ob}`);
  lines.push('- Next actions:');
  for (const na of g.memoryUpdate.nextActions) lines.push(`  - ${na}`);

  return lines.join('\n');
}

function schemaItemLine(item: SchemaChangeItem): string {
  const at = item.filePath !== undefined ? ` (${item.filePath})` : '';
  return `- ${item.name}${at} — ${item.description} [${item.evidence}]`;
}

function schemaGroup(lines: string[], title: string, items: SchemaChangeItem[]): void {
  if (items.length === 0) return;
  lines.push(`**${title}**`);
  for (const item of items) lines.push(schemaItemLine(item));
  lines.push('');
}

/** The talking points as a small copyable bullet list. */
export function technicalChangeBriefTalkingPointsToMarkdown(b: TechnicalChangeBrief): string {
  const lines: string[] = ['## Talking points'];
  if (b.talkingPoints.length === 0) lines.push('- None');
  for (const point of b.talkingPoints) lines.push(`- ${point}`);
  return lines.join('\n');
}

/** The files-worth-showing list as a small copyable document. */
export function technicalChangeBriefFilesToMarkdown(b: TechnicalChangeBrief): string {
  const lines: string[] = ['## Files worth showing'];
  if (b.filesWorthShowing.length === 0) lines.push('- None');
  for (const f of b.filesWorthShowing) {
    lines.push(`- ${f.path}`);
    lines.push(`  - Why it matters: ${f.whyItMatters}`);
    lines.push(`  - Point out: ${f.whatToPointOut}`);
  }
  return lines.join('\n');
}

/** Assemble the full Technical Change Brief as a single copyable markdown document. */
export function technicalChangeBriefToMarkdown(b: TechnicalChangeBrief): string {
  const lines: string[] = [];
  lines.push('# Technical Change Brief', '');

  lines.push('## Executive summary', '', b.executiveSummary, '');

  lines.push('## Data / schema changes', '', b.dataSchemaChanges.summary, '');
  const d = b.dataSchemaChanges;
  schemaGroup(lines, 'New fields', d.newFields);
  schemaGroup(lines, 'Changed fields', d.changedFields);
  schemaGroup(lines, 'Removed fields', d.removedFields);
  schemaGroup(lines, 'New schemas', d.newSchemas);
  schemaGroup(lines, 'Changed parser contracts', d.changedParserContracts);
  schemaGroup(lines, 'New status values / enums', d.newStatusValues);
  lines.push(`Persisted/session data impact: ${d.persistedDataImpact}`);
  lines.push(
    `Backward compatibility: ${d.backwardCompatibility} — ${d.backwardCompatibilityNote}`,
    '',
  );

  lines.push('## Models & types');
  if (b.modelsAndTypes.length === 0) lines.push('- None');
  for (const m of b.modelsAndTypes) {
    const at = m.filePath !== undefined ? ` (${m.filePath})` : '';
    lines.push(`### ${m.name}${at} [${m.evidence}]`);
    lines.push(`- Represents: ${m.represents}`);
    lines.push(`- Why needed: ${m.whyNeeded}`);
    lines.push('- Important fields:');
    for (const field of m.importantFields) lines.push(`  - ${field}`);
  }
  lines.push('');

  lines.push('## Inputs / API / flags');
  if (b.inputsApiFlags.length === 0) lines.push('- None');
  for (const i of b.inputsApiFlags) {
    const at = i.filePath !== undefined ? ` (${i.filePath})` : '';
    lines.push(`- [${i.kind}] ${i.name}${at} — ${i.description} [${i.evidence}]`);
  }
  lines.push('');

  const w = b.workflowRuntimeChanges;
  lines.push('## Workflow / runtime changes', '', w.summary, '');
  lines.push(`- Where it runs: ${w.whereItRuns}`);
  lines.push(`- Depends on: ${w.dependsOn.join(', ') || 'None'}`);
  lines.push(`- Consumes: ${w.consumesArtifacts.join(', ') || 'None'}`);
  lines.push(`- Produces: ${w.producesArtifact}`);
  lines.push(`- Cached / reused: ${w.cachedOrReused}`);
  lines.push(`- When the flag is off: ${w.behaviorWhenFlagOff}`, '');

  const u = b.uiChanges;
  lines.push('## UI changes', '', u.summary, '');
  if (u.hasChanges) {
    if (u.newCardsOrViews.length > 0) lines.push(`- New cards/views: ${u.newCardsOrViews.join(', ')}`);
    if (u.togglesOrButtons.length > 0) lines.push(`- Toggles/buttons: ${u.togglesOrButtons.join(', ')}`);
    if (u.copyActions.length > 0) lines.push(`- Copy actions: ${u.copyActions.join(', ')}`);
    if (u.sectionsDisplayed.length > 0) lines.push(`- Sections: ${u.sectionsDisplayed.join(', ')}`);
    lines.push(`- How to activate: ${u.howToActivate}`);
  }
  lines.push('');

  lines.push('## Interesting functionality deep dive');
  if (b.interestingFunctionality.length === 0) lines.push('- None');
  for (const f of b.interestingFunctionality) {
    lines.push(`### ${f.title}`);
    lines.push(`- What it does: ${f.whatItDoes}`);
    lines.push(`- Why it matters: ${f.whyItMatters}`);
    lines.push(`- How it works: ${f.howItWorks}`);
    lines.push(`- Files: ${f.filesInvolved.join(', ') || 'None'}`);
  }
  lines.push('');

  lines.push('## How it works, step by step');
  b.howItWorksStepByStep.forEach((step, index) => {
    const actor = step.actor !== undefined ? `${step.actor}: ` : '';
    const detail = step.detail !== undefined ? ` — ${step.detail}` : '';
    lines.push(`${index + 1}. ${actor}${step.action}${detail}`);
  });
  lines.push('');

  lines.push(technicalChangeBriefFilesToMarkdown(b), '');
  lines.push(technicalChangeBriefTalkingPointsToMarkdown(b));

  return lines.join('\n');
}

function demoLocationSuffix(filePath?: string, areaName?: string): string {
  if (filePath !== undefined) return ` (${filePath})`;
  if (areaName !== undefined) return ` (area: ${areaName})`;
  return '';
}

function inferredSuffix(evidence: 'confirmed' | 'inferred'): string {
  return evidence === 'inferred' ? ' [inferred]' : '';
}

/** The recommended walkthrough order as a copyable numbered plan. */
export function demoPrepLoopWalkthroughToMarkdown(x: DemoPrepLoop): string {
  const lines: string[] = ['## Walkthrough order'];
  if (x.walkthroughOrder.length === 0) lines.push('- None');
  for (const step of x.walkthroughOrder) {
    const mustShow = step.mustShow ? ' [must show]' : '';
    lines.push(
      `${step.order}. ${step.title}${demoLocationSuffix(step.filePath, step.areaName)}` +
        ` [${step.type}]${mustShow}${inferredSuffix(step.evidence)} (~${step.estimatedTimeSeconds}s)`,
    );
    lines.push(`   - Why here: ${step.whyThisComesHere}`);
    lines.push(`   - Show: ${step.whatToShow}`);
    lines.push(`   - Say: ${step.whatToSay}`);
    lines.push(`   - Skip: ${step.whatToSkip}`);
  }
  return lines.join('\n');
}

/** The manual screenshot plan as a copyable checklist. */
export function demoPrepLoopScreenshotPlanToMarkdown(x: DemoPrepLoop): string {
  const lines: string[] = ['## Screenshot plan (capture manually)'];
  if (x.screenshotPlan.length === 0) lines.push('- None');
  for (const shot of x.screenshotPlan) {
    const mustShow = shot.mustShow ? ' [must show]' : '';
    lines.push(`- ${shot.id}: ${shot.title} [${shot.type}]${mustShow}${inferredSuffix(shot.evidence)}`);
    if (shot.filePath !== undefined) lines.push(`  - File: ${shot.filePath}`);
    if (shot.codeArea !== undefined) lines.push(`  - Code area: ${shot.codeArea}`);
    if (shot.lineRange !== undefined) lines.push(`  - Lines: ${shot.lineRange}`);
    if (shot.uiArea !== undefined) lines.push(`  - UI area: ${shot.uiArea}`);
    lines.push(`  - Capture: ${shot.whatToCapture}`);
    lines.push(`  - Why: ${shot.whyThisMatters}`);
    lines.push(`  - Say: ${shot.whatToSay}`);
    lines.push(`  - Caption: ${shot.suggestedCaption}`);
  }
  return lines.join('\n');
}

/** The full deck plan (shown + said) as a copyable document. */
export function demoPrepLoopDeckPlanToMarkdown(x: DemoPrepLoop): string {
  const lines: string[] = ['## Deck plan'];
  if (x.deckPlan.length === 0) lines.push('- None');
  for (const slide of x.deckPlan) {
    const mustHave = slide.mustHave ? ' [must have]' : '';
    lines.push(`### Slide ${slide.slideNumber} — ${slide.title}${mustHave}`);
    lines.push(`- Purpose: ${slide.purpose}`);
    lines.push(`- Visual: ${slide.visualType}`);
    if (slide.screenshotIds !== undefined && slide.screenshotIds.length > 0) {
      lines.push(`- Screenshots: ${slide.screenshotIds.join(', ')}`);
    }
    lines.push(`- Show: ${slide.whatToShow}`);
    lines.push('- On slide:');
    for (const bullet of slide.onSlideText) lines.push(`  - ${bullet}`);
    lines.push(`- Speaker notes: ${slide.speakerNotes}`);
    lines.push(`- Narration: ${slide.narrationScript}`);
    lines.push(`- Transition: ${slide.transitionToNextSlide} (~${slide.estimatedTimeSeconds}s)`);
  }
  return lines.join('\n');
}

/** Only the per-slide speaker notes, for presenting live. */
export function demoPrepLoopSpeakerNotesToMarkdown(x: DemoPrepLoop): string {
  const lines: string[] = ['## Speaker notes'];
  if (x.deckPlan.length === 0) lines.push('- None');
  for (const slide of x.deckPlan) {
    lines.push(`### Slide ${slide.slideNumber} — ${slide.title}`);
    lines.push(slide.speakerNotes);
  }
  return lines.join('\n');
}

/** Only the per-slide narration script, for recording a video. */
export function demoPrepLoopNarrationToMarkdown(x: DemoPrepLoop): string {
  const lines: string[] = ['## Narration script'];
  if (x.deckPlan.length === 0) lines.push('- None');
  for (const slide of x.deckPlan) {
    lines.push(`### Slide ${slide.slideNumber} — ${slide.title}`);
    lines.push(slide.narrationScript);
  }
  return lines.join('\n');
}

/** Assemble the full Demo Prep Loop as a single copyable markdown document. */
export function demoPrepLoopToMarkdown(x: DemoPrepLoop): string {
  const lines: string[] = [];
  lines.push('# Demo Prep Loop', '');

  const s = x.loopStatus;
  lines.push('## Loop status', '');
  lines.push(`- Stage: ${s.currentStage}`);
  lines.push(`- Overall: ${s.overallStatus}`);
  lines.push(`- Next action: ${s.nextRecommendedAction}`);
  lines.push('- Waiting on your approval:');
  if (s.whatNeedsUserApproval.length === 0) lines.push('  - None');
  for (const item of s.whatNeedsUserApproval) lines.push(`  - ${item}`);
  lines.push('');

  const story = x.demoStoryProposal;
  lines.push('## Demo story (pending approval)', '');
  lines.push(`- Problem: ${story.problem}`);
  lines.push(`- Solution: ${story.solution}`);
  lines.push(`- Technical change: ${story.technicalChange}`);
  lines.push(`- Value: ${story.userOrProductValue}`);
  lines.push(`- Proof / demo moment: ${story.proofOrDemoMoment}`);
  lines.push(`- Limitations / next steps: ${story.limitationsOrNextSteps}`, '');

  lines.push(demoPrepLoopWalkthroughToMarkdown(x), '');

  lines.push('## Code evidence plan');
  if (x.codeEvidencePlan.length === 0) lines.push('- None');
  for (const item of x.codeEvidencePlan) {
    lines.push(
      `- [${item.evidenceType}]${demoLocationSuffix(item.filePath, item.areaName)}` +
        ` (confidence: ${item.confidence})${inferredSuffix(item.evidence)}`,
    );
    lines.push(`  - Proves: ${item.whatItProves}`);
    lines.push(`  - Why it matters: ${item.whyItMatters}`);
  }
  lines.push('');

  lines.push(demoPrepLoopScreenshotPlanToMarkdown(x), '');

  lines.push('## Approval questions');
  if (x.approvalQuestions.length === 0) lines.push('- None');
  for (const q of x.approvalQuestions) {
    lines.push(`- ${q.question}`);
    lines.push(`  - Why it matters: ${q.whyItMatters}`);
    lines.push(`  - Options: ${q.options.join(', ')}`);
    if (q.recommendedOption !== undefined) lines.push(`  - Recommended: ${q.recommendedOption}`);
  }
  lines.push('');

  lines.push(demoPrepLoopDeckPlanToMarkdown(x), '');

  const script = x.draftVideoScript;
  lines.push(`## Draft video script — ${script.title} (${script.estimatedDuration})`);
  script.sections.forEach((section, index) => {
    lines.push(`${index + 1}. [${section.kind}] ${section.title} (~${section.estimatedTimeSeconds}s)`);
    lines.push(`   - Narration: ${section.narration}`);
    lines.push(`   - Visual cue: ${section.visualCue}`);
  });
  lines.push('');

  lines.push('## Final short pitch', '', x.finalShortPitch, '');

  lines.push('## Readiness checklist');
  if (x.readinessChecklist.length === 0) lines.push('- None');
  for (const item of x.readinessChecklist) {
    lines.push(`- [${item.done ? 'x' : ' '}] ${item.item} — ${item.why}`);
  }

  return lines.join('\n');
}

// --- Weekly Review ---

/** The copy-ready Notion/Slack weekly update block. */
export function weeklyReviewUpdateToMarkdown(r: WeeklyReview): string {
  const u = r.suggestedWeeklyUpdate;
  return [
    `## Weekly Update — ${r.status.reviewPeriodLabel}`,
    '',
    '### This week',
    u.thisWeek,
    '',
    '### Technical progress',
    u.technicalProgress,
    '',
    '### Demo / product progress',
    u.demoProductProgress,
    '',
    '### Blockers',
    u.blockers,
    '',
    '### Next week',
    u.nextWeek,
  ].join('\n');
}

/** The demo/video story as a copyable block (base for a weekly recording). */
export function weeklyReviewDemoStoryToMarkdown(r: WeeklyReview): string {
  const d = r.demoVideoStory;
  const lines: string[] = ['## Demo / Video Story', '', d.strongestStory, ''];
  lines.push('### What to show');
  for (const s of d.whatToShow) lines.push(`- ${s}`);
  lines.push('', '### What to say');
  for (const s of d.whatToSay) lines.push(`- ${s}`);
  lines.push('', '### What to skip');
  for (const s of d.whatToSkip) lines.push(`- ${s}`);
  lines.push('', '### Recommended structure (5–7 min)');
  for (const seg of d.recommendedStructure) {
    lines.push(`- ${seg.title} (${seg.durationLabel}): ${seg.focus}`);
  }
  lines.push('', '### Key files / screens');
  for (const f of d.keyFilesOrScreens) lines.push(`- ${f}`);
  lines.push('', `Strongest product sentence: ${d.strongestProductSentence}`);
  return lines.join('\n');
}

export function weeklyReviewTalkingPointsToMarkdown(r: WeeklyReview): string {
  const lines: string[] = ['## Review talking points'];
  if (r.reviewTalkingPoints.length === 0) lines.push('- None');
  for (const p of r.reviewTalkingPoints) lines.push(`- ${p}`);
  return lines.join('\n');
}

export function weeklyReviewNextWeekToMarkdown(r: WeeklyReview): string {
  const lines: string[] = ['## Next week plan'];
  if (r.nextWeekPlan.length === 0) lines.push('- None');
  for (const item of r.nextWeekPlan) lines.push(`- ${item}`);
  return lines.join('\n');
}

/** The proposed memory update, formatted for review before saving. */
export function weeklyReviewMemoryProposalToMarkdown(r: WeeklyReview): string {
  const m = r.memoryUpdateProposal;
  const lines: string[] = ['## Memory update proposal', '', m.latestWeeklySummary, ''];
  lines.push('### Updated checklist statuses');
  if (m.updatedChecklistStatuses.length === 0) lines.push('- None');
  for (const c of m.updatedChecklistStatuses) lines.push(`- ${c.item}: ${c.status}`);
  lines.push('', '### New decisions');
  if (m.newDecisions.length === 0) lines.push('- None');
  for (const d of m.newDecisions) lines.push(`- ${d}`);
  lines.push('', '### Updated blockers');
  if (m.updatedBlockers.length === 0) lines.push('- None');
  for (const b of m.updatedBlockers) lines.push(`- ${b}`);
  lines.push('', '### Next actions');
  if (m.nextActions.length === 0) lines.push('- None');
  for (const a of m.nextActions) lines.push(`- ${a}`);
  lines.push('', `Demo story summary: ${m.demoStorySummary}`);
  lines.push('', '### Files worth showing');
  if (m.filesWorthShowing.length === 0) lines.push('- None');
  for (const f of m.filesWorthShowing) lines.push(`- ${f}`);
  return lines.join('\n');
}

/** Assemble the full Weekly Review as a single copyable markdown document. */
export function weeklyReviewToMarkdown(r: WeeklyReview): string {
  const lines: string[] = [];
  lines.push(`# Weekly Review — ${r.status.reviewPeriodLabel}`, '');
  lines.push(
    `Status: ${r.status.status} · Confidence: ${r.status.confidence}` +
      (r.status.missingInputs.length > 0
        ? ` · Missing inputs: ${r.status.missingInputs.join(', ')}`
        : ''),
    '',
  );

  lines.push('## Executive summary', '', r.executiveSummary, '');

  lines.push('## Progress against spec');
  if (r.progressAgainstSpec.length === 0) lines.push('- None');
  for (const p of r.progressAgainstSpec) {
    lines.push(`- ${p.title}: ${p.status} (source: ${p.source})`);
    lines.push(`  - Evidence: ${p.evidence}`);
    lines.push(`  - Notes: ${p.notes}`);
  }
  lines.push('');

  const tech = r.whatChangedTechnically;
  const techGroup = (label: string, items: { description: string; filePath?: string; evidence: string }[]): void => {
    lines.push(`### ${label}`);
    if (items.length === 0) lines.push('- None');
    for (const it of items) {
      const path = it.filePath !== undefined ? ` (${it.filePath})` : '';
      lines.push(`- ${it.description}${path} [${it.evidence}]`);
    }
  };
  lines.push('## What changed technically');
  techGroup('Schema / data', tech.schemaOrDataChanges);
  techGroup('Models / types', tech.modelOrTypeChanges);
  techGroup('Workflow / runtime', tech.workflowOrRuntimeChanges);
  techGroup('UI', tech.uiChanges);
  techGroup('Tools / skills added', tech.toolsOrSkillsAdded);
  lines.push('### Important files / modules');
  if (tech.importantFilesOrModules.length === 0) lines.push('- None');
  for (const f of tech.importantFilesOrModules) lines.push(`- ${f}`);
  lines.push('');

  lines.push('## Key decisions');
  if (r.keyDecisions.length === 0) lines.push('- None');
  for (const d of r.keyDecisions) {
    lines.push(`- [${d.status}] ${d.decision} (source: ${d.source})`);
    lines.push(`  - Why: ${d.why}`);
    lines.push(`  - Impact: ${d.impact}`);
  }
  lines.push('');

  lines.push('## Blockers / risks');
  if (r.blockersAndRisks.length === 0) lines.push('- None');
  for (const b of r.blockersAndRisks) {
    lines.push(`- [${b.status}] ${b.title}`);
    lines.push(`  - Why it matters: ${b.whyItMatters}`);
    lines.push(`  - Next action: ${b.suggestedNextAction}`);
  }
  lines.push('');

  lines.push(weeklyReviewDemoStoryToMarkdown(r), '');
  lines.push(weeklyReviewTalkingPointsToMarkdown(r), '');
  lines.push(weeklyReviewUpdateToMarkdown(r), '');
  lines.push(weeklyReviewNextWeekToMarkdown(r), '');
  lines.push(weeklyReviewMemoryProposalToMarkdown(r));

  return lines.join('\n');
}
