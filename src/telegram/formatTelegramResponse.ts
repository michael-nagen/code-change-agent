/**
 * Pure formatters that turn artifacts and preferences into concise Telegram
 * messages. No I/O. They read only the storage-agnostic artifact/memory types,
 * so they stay decoupled from the UI's own view models.
 *
 * Telegram messages have a hard length limit; these keep summaries compact,
 * cap long lists, and point to the UI for the full artifact when useful.
 */
import type { DailyWorkGuidance } from '../skills/dailyWorkGuidance/index.js';
import type { TechnicalChangeBrief } from '../skills/technicalChangeBrief/index.js';
import type { DemoPrepLoop } from '../skills/demoPrepLoop/index.js';
import type { WeeklyReview } from '../skills/weeklyReview/index.js';
import type { AnalysisResult } from '../analysis/index.js';
import type { PromptPreferences, ProjectMemory } from '../memory/index.js';
import type { UiMode } from '../ui/types.js';

/** Telegram rejects messages over 4096 chars; keep a safety margin. */
const TELEGRAM_LIMIT = 3800;

/** Truncate a full message, adding a hint to open the UI for the rest. */
export function clampForTelegram(text: string): string {
  if (text.length <= TELEGRAM_LIMIT) return text;
  return `${text.slice(0, TELEGRAM_LIMIT - 60).trimEnd()}\n\n… (truncated — open the UI for the full artifact)`;
}

function modeNote(mode: UiMode): string[] {
  return mode === 'mock'
    ? ['', '(demo/mock output — set UI_MODE=real for the real engine)']
    : [];
}

/** Take the first `n` items and, if truncated, note how many more there are. */
function capped<T>(items: T[], n: number, render: (item: T) => string): string[] {
  const shown = items.slice(0, n).map(render);
  if (items.length > n) shown.push(`… +${items.length - n} more`);
  return shown;
}

export function formatDailyGuidance({
  projectLabel,
  guidance,
  mode,
}: {
  projectLabel: string;
  guidance: DailyWorkGuidance;
  mode: UiMode;
}): string {
  const lines: string[] = [`Daily Work Checkpoint — ${projectLabel}`, '', guidance.headline];

  if (guidance.whatChanged.length > 0) {
    lines.push('', 'What we did:');
    lines.push(...capped(guidance.whatChanged, 6, (s) => `• ${s}`));
  }

  if (guidance.nextActions.length > 0) {
    lines.push('', 'What to do next:');
    lines.push(...capped(guidance.nextActions, 6, (s) => `• ${s}`));
  }

  if (guidance.blockersOrDecisions.length > 0) {
    lines.push('', 'Blockers / decisions:');
    lines.push(...capped(guidance.blockersOrDecisions, 5, (s) => `• ${s}`));
  }

  lines.push('', 'Reply /save daily to store this progress in project memory.');
  lines.push(...modeNote(mode));
  return clampForTelegram(lines.join('\n'));
}

export function formatTechnicalBrief({
  projectLabel,
  brief,
  mode,
}: {
  projectLabel: string;
  brief: TechnicalChangeBrief;
  mode: UiMode;
}): string {
  const lines: string[] = [`Technical Change Brief — ${projectLabel}`, '', brief.executiveSummary];

  const changes = [
    ...brief.dataSchemaChanges.newFields,
    ...brief.dataSchemaChanges.changedFields,
    ...brief.modelsAndTypes.map((m) => ({ name: m.name, description: m.represents })),
  ];
  if (changes.length > 0) {
    lines.push('', 'Technical changes:');
    lines.push(...capped(changes, 6, (c) => `• ${c.name}: ${c.description}`));
  }

  if (brief.filesWorthShowing.length > 0) {
    lines.push('', 'Files worth showing:');
    lines.push(...capped(brief.filesWorthShowing, 6, (f) => `• ${f.path} — ${f.whatToPointOut}`));
  }

  if (brief.talkingPoints.length > 0) {
    lines.push('', 'Talking points:');
    lines.push(...capped(brief.talkingPoints, 6, (t) => `• ${t}`));
  }

  lines.push(...modeNote(mode));
  return clampForTelegram(lines.join('\n'));
}

export function formatDemoPrep({
  projectLabel,
  demo,
  mode,
}: {
  projectLabel: string;
  demo: DemoPrepLoop;
  mode: UiMode;
}): string {
  const story = demo.demoStoryProposal;
  const lines: string[] = [
    `Demo Prep — ${projectLabel}`,
    '',
    'Demo story:',
    `• Problem: ${story.problem}`,
    `• Solution: ${story.solution}`,
    `• Proof: ${story.proofOrDemoMoment}`,
  ];

  if (demo.walkthroughOrder.length > 0) {
    lines.push('', 'Walkthrough order:');
    lines.push(
      ...capped(demo.walkthroughOrder, 6, (w) => `${w.order}. ${w.title}${w.filePath ? ` (${w.filePath})` : ''}`),
    );
  }

  lines.push(
    '',
    `Screenshot plan: ${demo.screenshotPlan.length} shot(s) to capture manually.`,
  );

  lines.push('', 'Short pitch:', demo.finalShortPitch);

  lines.push(
    '',
    `Deck plan: ${demo.deckPlan.length} slide(s). Open the UI to export the Markdown/PPTX deck (binary sending from Telegram is not enabled).`,
  );

  lines.push(...modeNote(mode));
  return clampForTelegram(lines.join('\n'));
}

export function formatWeeklyReview({
  projectLabel,
  review,
  mode,
}: {
  projectLabel: string;
  review: WeeklyReview;
  mode: UiMode;
}): string {
  const lines: string[] = [
    `Weekly Review — ${projectLabel} (${review.status.reviewPeriodLabel})`,
    '',
    review.executiveSummary,
  ];

  if (review.progressAgainstSpec.length > 0) {
    lines.push('', 'Progress against spec:');
    lines.push(...capped(review.progressAgainstSpec, 6, (p) => `• [${p.status}] ${p.title}`));
  }

  const story = review.demoVideoStory.strongestStory.trim();
  if (story !== '') {
    lines.push('', 'Demo / video story:', story);
  }

  const u = review.suggestedWeeklyUpdate;
  lines.push(
    '',
    'Suggested weekly update:',
    `• This week: ${u.thisWeek}`,
    `• Blockers: ${u.blockers}`,
    `• Next week: ${u.nextWeek}`,
  );

  if (review.nextWeekPlan.length > 0) {
    lines.push('', 'Next week plan:');
    lines.push(...capped(review.nextWeekPlan, 6, (n) => `• ${n}`));
  }

  lines.push('', 'Reply /save weekly to store this in project memory.');
  lines.push(...modeNote(mode));
  return clampForTelegram(lines.join('\n'));
}

export function formatAnalyzeSummary({
  projectLabel,
  result,
  mode,
}: {
  projectLabel: string;
  result: AnalysisResult;
  mode: UiMode;
}): string {
  const lines: string[] = [
    `Analysis ready — ${projectLabel}`,
    '',
    result.changeExplanation.changeStory,
    '',
    `Requirement confidence: ${result.requirementAlignment.confidence}`,
    ...(result.gapReport !== undefined ? [`PR readiness: ${result.gapReport.readiness}`] : []),
    '',
    'Generate an output: /daily, /technical, /demo, or /weekly.',
  ];
  lines.push(...modeNote(mode));
  return clampForTelegram(lines.join('\n'));
}

export function formatNextActions({
  projectLabel,
  memory,
}: {
  projectLabel: string;
  memory: ProjectMemory | undefined;
}): string {
  const next = memory?.latestSnapshot?.nextActions ?? [];
  if (next.length === 0) {
    return `Project: ${projectLabel}\n\nNo next actions saved yet.`;
  }
  return [`Next actions — ${projectLabel}`, '', ...next.map((n, i) => `${i + 1}. ${n}`)].join('\n');
}

export function formatBlockers({
  projectLabel,
  memory,
}: {
  projectLabel: string;
  memory: ProjectMemory | undefined;
}): string {
  const blockers = memory?.latestSnapshot?.openBlockers ?? [];
  if (blockers.length === 0) {
    return `Project: ${projectLabel}\n\nNo open blockers saved.`;
  }
  return [`Open blockers — ${projectLabel}`, '', ...blockers.map((b) => `• ${b}`)].join('\n');
}

export function formatPreferences(preferences: PromptPreferences | undefined): string {
  if (preferences === undefined) {
    return 'No prompt/working preferences saved yet. Set them in the UI Project Memory panel.';
  }
  const lines: string[] = ['Your prompt / working preferences:'];
  const sections: { label: string; items: string[] | undefined }[] = [
    { label: 'Cursor', items: preferences.cursor },
    { label: 'Claude Code', items: preferences.claudeCode },
    { label: 'Code review', items: preferences.codeReview },
    { label: 'Daily update', items: preferences.dailyUpdate },
    { label: 'Weekly review', items: preferences.weeklyReview },
    { label: 'Demo / video', items: preferences.demoVideo },
    { label: 'Mentor / manager update', items: preferences.mentorUpdate },
  ];
  let any = false;
  for (const { label, items } of sections) {
    const bullets = (items ?? []).map((i) => i.trim()).filter((i) => i !== '');
    if (bullets.length === 0) continue;
    any = true;
    lines.push('', `${label}:`, ...bullets.map((b) => `• ${b}`));
  }
  if (!any) {
    return 'No prompt/working preferences saved yet. Set them in the UI Project Memory panel.';
  }
  return clampForTelegram(lines.join('\n'));
}

export function formatHelp(): string {
  return [
    'Commands:',
    '/start — what this bot does',
    '/help — this list',
    '/status [project] — latest summary, progress, blockers, next actions',
    '/summary [project] — short high-level summary',
    '/projects — list projects with saved memory',
    '/project [name] — show or set the active project',
    '/latest — re-show the last generated artifact',
    '/memory [project] — compact memory snapshot',
    '/next — next actions only',
    '/blockers — open blockers/risks',
    '/preferences — your saved prompt/working preferences',
    '/analyze [project] [spec: … diff: …] — run/reuse analysis',
    '/daily — generate Daily Work Guidance',
    '/technical — generate Technical Change Brief',
    '/demo — generate Demo Prep Loop',
    '/weekly — generate Weekly Review',
    '/save [daily|weekly] — save the latest proposed memory update',
    '/notion daily|weekly|demo|memory — send the latest artifact to Notion (explicit)',
    '/clear [confirm] — clear project memory (confirmation required)',
    '/edit — how to edit a result (reply to it with your change)',
    '',
    'You can also just describe what you want in plain language.',
    'To tweak a result, reply to it, e.g. "make it shorter" or "translate to Hebrew".',
  ].join('\n');
}

export function formatStart({
  defaultProject,
  generationAvailable,
  mode,
}: {
  defaultProject?: string;
  generationAvailable: boolean;
  mode: UiMode;
}): string {
  const lines: string[] = [
    'I am your Developer Work Companion bot. I read your project memory and drive the same analysis workflow the app uses.',
    '',
    `Default project: ${defaultProject !== undefined && defaultProject.trim() !== '' ? defaultProject : '(none — set TELEGRAM_DEFAULT_PROJECT or use /project)'}`,
    generationAvailable
      ? `Engine: ${mode === 'real' ? 'REAL (DB/analysis configured)' : 'MOCK/DEMO (set UI_MODE=real + OPENAI_API_KEY for real output)'}`
      : 'Engine: generation is not configured on this deployment (read-only).',
    '',
    formatHelp(),
  ];
  return clampForTelegram(lines.join('\n'));
}
