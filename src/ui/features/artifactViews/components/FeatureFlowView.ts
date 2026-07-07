/** Presentation: the "Feature Flow" (FlowArtifact) artifact body. */
import type { FlowArtifact } from '../../../../skills/flowGeneration/index.js';
import { section, list, paragraph, codeBlock } from './viewHelpers.js';

export function renderFlow(flow: FlowArtifact): string {
  return [
    section(flow.title, paragraph(flow.description)),
    section('Steps', list(flow.steps)),
    section(
      'Mermaid (text)',
      `<p class="muted">Diagram rendering isn't included yet — shown as Mermaid source.</p>${codeBlock(flow.mermaid)}`,
    ),
  ].join('');
}
