import type { DeckSlide } from '../../skills/demoPrepLoop/index.js';
import type { MarkdownDeckInput } from './types.js';
import { slideVisualLines } from './slideVisuals.js';

/**
 * Renders a deck plan as a Markdown presentation document: one section per
 * slide, separated by `---`, each with the on-slide text, a visual/screenshot
 * placeholder, the speaker notes, and the narration script.
 *
 * Pure and total: it never throws. Unknown screenshot ids render an explicit
 * "not found" placeholder and an empty deck renders a friendly notice, so this
 * is safe to call from render paths.
 */
export function buildMarkdownDeck(input: MarkdownDeckInput): string {
  const lines: string[] = [];

  lines.push(`# Demo Deck — ${input.metadata?.title ?? 'Demo Presentation'}`);
  const contextLine = metadataContextLine(input.metadata);
  if (contextLine !== undefined) {
    lines.push('', contextLine);
  }

  if (input.deckPlan.length === 0) {
    lines.push('', '_No slides in the deck plan yet._');
    return lines.join('\n');
  }

  const shotsById = new Map((input.screenshotPlan ?? []).map((shot) => [shot.id, shot]));

  for (const slide of input.deckPlan) {
    lines.push('', '---', '');
    lines.push(`## Slide ${slide.slideNumber} — ${slide.title}`, '');
    lines.push(`**Purpose:** ${slide.purpose}`);
    lines.push(`**Visual:** ${slide.visualType}`, '');
    lines.push(...slideVisualLines({ slide, shotsById }).map((line) => `> ${line}`), '');
    lines.push('**On slide:**');
    if (slide.onSlideText.length === 0) {
      lines.push('- (no on-slide text)');
    } else {
      lines.push(...slide.onSlideText.map((bullet) => `- ${bullet}`));
    }
    lines.push('', '**Speaker notes:**', slide.speakerNotes);
    lines.push('', '**Narration script:**', slide.narrationScript);
    lines.push('', slideFooter(slide));
  }

  return lines.join('\n');
}

function metadataContextLine(metadata: MarkdownDeckInput['metadata']): string | undefined {
  const parts: string[] = [];
  if (metadata?.projectName !== undefined) {
    parts.push(`Project: ${metadata.projectName}`);
  }
  if (metadata?.date !== undefined) {
    parts.push(`Date: ${metadata.date}`);
  }
  return parts.length > 0 ? `_${parts.join(' · ')}_` : undefined;
}

function slideFooter(slide: DeckSlide): string {
  const mustHave = slide.mustHave ? ' · must-have' : '';
  return `_Transition: ${slide.transitionToNextSlide} · ~${slide.estimatedTimeSeconds}s${mustHave}_`;
}
