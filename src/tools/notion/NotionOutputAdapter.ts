import {
  formatChangeExplanation,
  formatRequirementAlignment,
  formatGapReport,
  formatFlowArtifact,
  formatPRDescription,
  formatVideoScript,
  formatDailyUpdate,
} from './sections.js';
import type {
  NotionArtifacts,
  NotionOutputAdapter,
  NotionOutputAdapterInput,
  NotionOutputResult,
} from './types.js';

/**
 * Formats already-produced artifacts into Notion-ready text.
 *
 * This first version is in-memory/text-based: it returns the exact content that
 * would later be written to Notion. It only formats — it never analyzes or
 * reinterprets artifacts, never hides gaps/risks/missing/unclear items, and
 * never invents an artifact that was not provided.
 */
export class DefaultNotionOutputAdapter implements NotionOutputAdapter {
  readonly name = 'notion-output';

  async execute({
    notionPageId,
    notionUrl,
    artifacts,
  }: NotionOutputAdapterInput): Promise<NotionOutputResult> {
    const sections = buildSections(artifacts);

    return {
      source: 'notion',
      destination: {
        ...(notionPageId !== undefined ? { pageId: notionPageId } : {}),
        ...(notionUrl !== undefined ? { url: notionUrl } : {}),
      },
      writtenSections: sections.map((section) => section.key),
      content: sections.map((section) => section.content).join('\n\n'),
    };
  }
}

/**
 * Builds the sections in a fixed canonical order, including only the artifacts
 * that were provided. Handled per key so the formatting stays fully type-safe.
 */
function buildSections(artifacts: NotionArtifacts): Array<{ key: string; content: string }> {
  const sections: Array<{ key: string; content: string }> = [];

  if (artifacts.changeExplanation !== undefined) {
    sections.push({
      key: 'changeExplanation',
      content: formatChangeExplanation(artifacts.changeExplanation),
    });
  }
  if (artifacts.requirementAlignment !== undefined) {
    sections.push({
      key: 'requirementAlignment',
      content: formatRequirementAlignment(artifacts.requirementAlignment),
    });
  }
  if (artifacts.gapReport !== undefined) {
    sections.push({ key: 'gapReport', content: formatGapReport(artifacts.gapReport) });
  }
  if (artifacts.flowArtifact !== undefined) {
    sections.push({ key: 'flowArtifact', content: formatFlowArtifact(artifacts.flowArtifact) });
  }
  if (artifacts.prDescription !== undefined) {
    sections.push({
      key: 'prDescription',
      content: formatPRDescription(artifacts.prDescription),
    });
  }
  if (artifacts.videoScript !== undefined) {
    sections.push({ key: 'videoScript', content: formatVideoScript(artifacts.videoScript) });
  }
  if (artifacts.dailyUpdate !== undefined) {
    sections.push({ key: 'dailyUpdate', content: formatDailyUpdate(artifacts.dailyUpdate) });
  }

  return sections;
}
