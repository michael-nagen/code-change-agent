/**
 * Deterministic formatters that turn an existing artifact object into simple
 * Notion append content — a title plus a plain-text body.
 *
 * These are PURE and do NO LLM work: the model already produced the artifact;
 * write-back just re-shapes fields the user chose to send. The connector's
 * `appendToPage` takes plain text, so we emit readable text (never Notion block
 * JSON). Nothing is invented — every line comes from the artifact/memory.
 */
import type { DailyWorkGuidance } from '../skills/dailyWorkGuidance/index.js';
import type { WeeklyReview } from '../skills/weeklyReview/index.js';
import type { DemoPrepLoop } from '../skills/demoPrepLoop/index.js';
import type { ProjectMemory } from '../memory/index.js';

/** A title + plain-text body ready to append to a Notion page. */
export interface NotionWriteContent {
  title: string;
  body: string;
}

/** The date portion (YYYY-MM-DD) of an ISO timestamp. */
function isoDate(now: string): string {
  return now.slice(0, 10);
}

/** A "Heading:\nvalue" section, with a blank line after. Empty values → "None". */
function section(heading: string, value: string): string[] {
  const text = value.trim() === '' ? 'None' : value.trim();
  return [`${heading}:`, text, ''];
}

/** A "Heading:" followed by a bulleted list (or "- None"). */
function listSection(heading: string, items: readonly string[]): string[] {
  const lines = [`${heading}:`];
  if (items.length === 0) lines.push('- None');
  else for (const item of items) lines.push(`- ${item}`);
  lines.push('');
  return lines;
}

/** Daily Work Guidance → Notion content (uses the Notion-ready daily update). */
export function formatDailyForNotion({
  guidance,
  now,
}: {
  guidance: DailyWorkGuidance;
  now: string;
}): NotionWriteContent {
  const date = guidance.memoryUpdate.date.trim() !== '' ? guidance.memoryUpdate.date : isoDate(now);
  const u = guidance.notionDailyUpdate;
  const body = [
    ...section('Yesterday', u.yesterday),
    ...section('Today', u.today),
    ...section('Blockers', u.blockers),
    ...section('Decisions needed', u.decisionsNeeded),
    ...section('Progress vs spec', u.progressVsSpec),
    ...section('Next Cursor/Claude prompt', u.nextCursorPrompt),
  ]
    .join('\n')
    .trimEnd();
  return { title: `Daily Work Guidance — ${date}`, body };
}

/** Weekly Review → Notion content (uses the suggested weekly update block). */
export function formatWeeklyForNotion({
  review,
  now,
}: {
  review: WeeklyReview;
  now: string;
}): NotionWriteContent {
  const period =
    review.status.reviewPeriodLabel.trim() !== '' ? review.status.reviewPeriodLabel : isoDate(now);
  const u = review.suggestedWeeklyUpdate;
  const body = [
    ...section('This week', u.thisWeek),
    ...section('Technical progress', u.technicalProgress),
    ...section('Demo / product progress', u.demoProductProgress),
    ...section('Blockers', u.blockers),
    ...section('Next week', u.nextWeek),
  ]
    .join('\n')
    .trimEnd();
  return { title: `Weekly Review — ${period}`, body };
}

/** Demo Prep Loop → Notion content (demo story, walkthrough, plans, pitch). */
export function formatDemoForNotion({
  demo,
  now,
}: {
  demo: DemoPrepLoop;
  now: string;
}): NotionWriteContent {
  const s = demo.demoStoryProposal;
  const walkthrough = demo.walkthroughOrder.map((step) => `${step.order}. ${step.title}`);
  const screenshots = demo.screenshotPlan.map((shot) => shot.title);
  const slides = demo.deckPlan.map((slide) => `Slide ${slide.slideNumber} — ${slide.title}`);
  const deckStatus =
    demo.deckPlan.length > 0
      ? `Deck plan has ${demo.deckPlan.length} slide(s). Download the Markdown/PPTX deck from the workspace UI.`
      : 'No deck plan generated. Deck files (Markdown/PPTX) are downloadable from the workspace UI when available.';

  const body = [
    'Demo story:',
    `- Problem: ${s.problem}`,
    `- Solution: ${s.solution}`,
    `- Technical change: ${s.technicalChange}`,
    `- Value: ${s.userOrProductValue}`,
    `- Proof / demo moment: ${s.proofOrDemoMoment}`,
    '',
    ...listSection('Walkthrough order', walkthrough),
    ...listSection('Screenshot plan', screenshots),
    ...listSection('Slide plan', slides),
    ...section('Short pitch', demo.finalShortPitch),
    ...section('Deck status', deckStatus),
  ]
    .join('\n')
    .trimEnd();
  return { title: `Demo Prep Summary — ${isoDate(now)}`, body };
}

/** Project memory → Notion content (a durable snapshot of the project state). */
export function formatMemorySnapshotForNotion({
  memory,
  now,
}: {
  memory: ProjectMemory;
  now: string;
}): NotionWriteContent {
  const snapshot = memory.latestSnapshot;
  const date = snapshot?.date !== undefined && snapshot.date.trim() !== '' ? snapshot.date : isoDate(now);
  const checklist = (snapshot?.updatedChecklistStatuses ?? []).map((c) => `${c.item}: ${c.status}`);

  const body = [
    ...section('Active spec summary', memory.activeSpecSummary ?? ''),
    ...section('Latest summary', snapshot?.dailySummary ?? ''),
    ...listSection('Checklist statuses', checklist),
    ...listSection('Decisions', snapshot?.openDecisions ?? []),
    ...listSection('Blockers', snapshot?.openBlockers ?? []),
    ...listSection('Next actions', snapshot?.nextActions ?? []),
    ...section('Last updated', memory.updatedAt),
  ]
    .join('\n')
    .trimEnd();
  return { title: `Project Memory Snapshot — ${date}`, body };
}
