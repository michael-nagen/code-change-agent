/** Presentation: the "Walkthrough Script" (VideoScript) artifact body. */
import type { VideoScript } from '../../../../skills/videoScript/index.js';
import { escapeHtml } from '../../../escapeHtml.js';
import { section, list } from './viewHelpers.js';

export function renderVideoScript(vs: VideoScript): string {
  const sections = vs.sections
    .map(
      (s) =>
        `<section class="artifact-section"><h5>${escapeHtml(s.title)}</h5>` +
        `<p><strong>Narration:</strong> ${escapeHtml(s.narration)}</p>` +
        `<p class="muted"><strong>Visual cue:</strong> ${escapeHtml(s.visualCue)}</p></section>`,
    )
    .join('');
  return [
    section(
      vs.title,
      `<p class="muted">Audience: ${escapeHtml(vs.targetAudience)} · Duration: ${escapeHtml(vs.estimatedDuration)}</p>`,
    ),
    `<div>${sections}</div>`,
    section('Key Takeaways', list(vs.keyTakeaways)),
  ].join('');
}
