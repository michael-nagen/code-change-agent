/**
 * Render structured personal working / prompt preferences into a plain-text
 * guidance block for skills.
 *
 * Preferences are FORMAT / STYLE / WORKFLOW guidance only: they shape how an
 * artifact reads, never the factual claims it makes about the code. The current
 * spec/diff remains the source of truth. This renderer lives in the memory
 * module (it only touches memory types) so skills stay decoupled from the
 * preference structure and receive a ready-to-inject string, mirroring how
 * `previousProgressMemory` is passed today.
 */
import type { GeneralResponsePreferences, PromptPreferences } from './types/memory.js';

/** The list-based preference categories a skill can consume. */
export type PromptPreferenceCategory =
  | 'cursor'
  | 'claudeCode'
  | 'codeReview'
  | 'dailyUpdate'
  | 'weeklyReview'
  | 'demoVideo'
  | 'mentorUpdate';

const CATEGORY_LABELS: Record<PromptPreferenceCategory, string> = {
  cursor: 'Cursor prompt preferences',
  claudeCode: 'Claude Code prompt preferences',
  codeReview: 'Code review preferences',
  dailyUpdate: 'Daily update preferences',
  weeklyReview: 'Weekly review preferences',
  demoVideo: 'Demo / video preferences',
  mentorUpdate: 'Mentor / manager / teammate update preferences',
};

function renderGeneral(general: GeneralResponsePreferences | undefined): string[] {
  if (general === undefined) return [];
  const lines: string[] = [];
  if (general.preferredLanguage) lines.push(`- Language: ${general.preferredLanguage}`);
  if (general.preferredTone) lines.push(`- Tone: ${general.preferredTone}`);
  if (general.preferredOutputLength) lines.push(`- Output length: ${general.preferredOutputLength}`);
  if (general.preferredStructure) lines.push(`- Structure: ${general.preferredStructure}`);
  if (general.includeConciseSummaries !== undefined) {
    lines.push(`- Include concise summaries: ${general.includeConciseSummaries ? 'yes' : 'no'}`);
  }
  if (general.includeDetailedImplementationPrompts !== undefined) {
    lines.push(
      `- Include detailed implementation prompts: ${
        general.includeDetailedImplementationPrompts ? 'yes' : 'no'
      }`,
    );
  }
  if (lines.length === 0) return [];
  return ['General response preferences:', ...lines];
}

/**
 * Build a plain-text preferences block for the given categories, always
 * including any general preferences. Returns `undefined` when there is nothing
 * meaningful to say, so callers can omit the section entirely (and never leak an
 * empty or `undefined` block into a prompt).
 */
export function renderPromptPreferences({
  preferences,
  categories,
}: {
  preferences: PromptPreferences | undefined;
  categories: PromptPreferenceCategory[];
}): string | undefined {
  if (preferences === undefined) return undefined;

  const sections: string[] = [];

  const general = renderGeneral(preferences.general);
  if (general.length > 0) sections.push(general.join('\n'));

  for (const category of categories) {
    const items = preferences[category];
    if (items === undefined) continue;
    const bullets = items.map((i) => i.trim()).filter((i) => i !== '');
    if (bullets.length === 0) continue;
    sections.push([`${CATEGORY_LABELS[category]}:`, ...bullets.map((b) => `- ${b}`)].join('\n'));
  }

  if (sections.length === 0) return undefined;

  return [
    'USER PROMPT / WORKING PREFERENCES (apply to FORMAT, STYLE, and WORKFLOW only — never override facts grounded in the analysis, the spec, or the diff):',
    ...sections,
  ].join('\n');
}
