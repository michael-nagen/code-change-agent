/**
 * Project the run's normalized project context into a friendly, display-only
 * list of sources for the UI's Sources panel.
 *
 * This is a pure projection over data already assembled by the analysis layer:
 * it exposes where context came from (manual input, memory, GitHub, Notion)
 * without leaking full source text or Raw JSON into the product surface.
 */
import type { NormalizedProjectContext } from '../sources/index.js';
import type { SourceSummary } from './types.js';

export function summarizeSources(context: NormalizedProjectContext | undefined): SourceSummary[] {
  if (context === undefined) return [];
  return context.sources.map((source) => ({
    kind: source.source.kind,
    ...(source.source.title !== undefined ? { title: source.source.title } : {}),
    ...(source.source.url !== undefined ? { url: source.source.url } : {}),
    ...(source.summary !== undefined ? { summary: source.summary } : {}),
  }));
}
