/**
 * Shared visual-placeholder wording for the deck builders.
 *
 * Both the Markdown and PPTX builders describe a slide's visual the same way
 * (screenshot references resolved against the screenshot plan, with an
 * explicit "not found" line for unknown ids), so the wording lives here once.
 * Total: never throws, so builders stay safe to call from render paths.
 */
import type { DeckSlide, ScreenshotPlanItem } from '../../skills/demoPrepLoop/index.js';

export function slideVisualLines({
  slide,
  shotsById,
}: {
  slide: DeckSlide;
  shotsById: ReadonlyMap<string, ScreenshotPlanItem>;
}): string[] {
  const ids = slide.screenshotIds ?? [];
  if (ids.length === 0) {
    return [`[Visual placeholder: ${slide.visualType} — ${slide.whatToShow}]`];
  }

  const lines: string[] = [];
  for (const id of ids) {
    const shot = shotsById.get(id);
    if (shot === undefined) {
      lines.push(`[Screenshot placeholder: ${id} — not found in the screenshot plan]`);
      continue;
    }
    lines.push(`[Screenshot placeholder: ${id} — "${shot.title}"]`);
    lines.push(`Capture: ${shot.whatToCapture}`);
    lines.push(`Caption: ${shot.suggestedCaption}`);
  }
  return lines;
}
