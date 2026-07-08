/**
 * Deterministic builder for the unified project context. No LLM reasoning.
 *
 * Rules (per the integration spec):
 *  - the current explicit input (manual requirement/diff) is the source of truth;
 *  - memory is supporting context only;
 *  - missing external sources never break manual flows;
 *  - source metadata is preserved;
 *  - a useful `sourceSummary` is built from whatever is present.
 */
import type { DeveloperMemoryContext } from '../memory/index.js';
import type {
  NormalizedProjectContext,
  NormalizedProjectSource,
  ProjectSourceKind,
} from './types.js';

export function buildNormalizedProjectContext({
  manualRequirementText,
  manualDiffText,
  memoryContext,
  externalSources = [],
  now = new Date().toISOString(),
}: {
  manualRequirementText?: string;
  manualDiffText?: string;
  memoryContext?: DeveloperMemoryContext;
  externalSources?: NormalizedProjectSource[];
  now?: string;
}): NormalizedProjectContext {
  const sources: NormalizedProjectSource[] = [];

  const requirementText = nonEmpty(manualRequirementText);
  if (requirementText !== undefined) {
    sources.push({
      source: { kind: 'manual', title: 'Manual requirement / spec', fetchedAt: now, confidence: 'confirmed' },
      text: requirementText,
      summary: 'The requirement/spec pasted for this run (source of truth).',
    });
  }

  const diffText = nonEmpty(manualDiffText);
  if (diffText !== undefined) {
    sources.push({
      source: { kind: 'manual', title: 'Manual diff', fetchedAt: now, confidence: 'confirmed' },
      text: diffText,
      summary: 'The code diff pasted for this run (source of truth).',
    });
  }

  const memoryText = nonEmpty(memoryContext?.previousProgressMemory);
  if (memoryText !== undefined) {
    sources.push({
      source: {
        kind: 'memory',
        title: 'Saved project memory',
        fetchedAt: now,
        confidence: 'confirmed',
        ...(memoryContext?.projectId !== undefined ? { id: memoryContext.projectId } : {}),
      },
      text: memoryText,
      summary: 'Prior progress carried in from project memory (supporting context).',
    });
  }

  // External sources are appended as-is so their references/metadata are preserved.
  for (const external of externalSources) {
    sources.push(external);
  }

  const context: NormalizedProjectContext = {
    sources,
    sourceSummary: buildSourceSummary(sources),
    ...(requirementText !== undefined ? { requirementText } : {}),
    ...(diffText !== undefined ? { diffText } : {}),
    ...(memoryText !== undefined ? { memoryText } : {}),
  };
  return context;
}

const KIND_LABELS: Record<ProjectSourceKind, string> = {
  manual: 'manual input',
  memory: 'project memory',
  github: 'GitHub',
  notion: 'Notion',
  daily: 'daily guidance',
  weekly: 'weekly review',
  technical_brief: 'technical brief',
  demo_prep: 'demo prep',
};

function buildSourceSummary(sources: NormalizedProjectSource[]): string {
  if (sources.length === 0) {
    return 'No sources available for this run.';
  }
  const parts = sources.map((s) => {
    const label = KIND_LABELS[s.source.kind];
    const detail = s.source.title ?? s.source.url ?? s.source.id;
    return detail !== undefined ? `${label} (${detail})` : label;
  });
  return `Context assembled from ${sources.length} source(s): ${parts.join('; ')}.`;
}

function nonEmpty(value: string | undefined): string | undefined {
  return value !== undefined && value.trim() !== '' ? value : undefined;
}
