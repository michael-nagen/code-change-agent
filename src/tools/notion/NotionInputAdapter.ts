import { ToolError } from '../../errors/ToolError.js';
import type {
  NotionInputAdapter,
  NotionInputAdapterInput,
  NotionRequirementInput,
} from './types.js';

/**
 * Acquires requirement text from a Notion-like source.
 *
 * This first version is in-memory/text-based: it supports `rawText` directly.
 * Real Notion API page fetching is not configured yet, so a request without
 * usable `rawText` fails clearly rather than guessing. It performs no reasoning —
 * no skills, no prompts, no LLM, no judgement about what is important.
 * `requirementText` is preserved verbatim; normalization happens downstream.
 */
export class DefaultNotionInputAdapter implements NotionInputAdapter {
  readonly name = 'notion-input';

  async execute({
    notionPageId,
    notionUrl,
    rawText,
    title,
  }: NotionInputAdapterInput): Promise<NotionRequirementInput> {
    if (rawText === undefined || rawText.trim().length === 0) {
      throw new ToolError(
        'VALIDATION',
        'NotionInputAdapter requires rawText; real Notion page fetching is not configured yet.',
      );
    }

    const metadata = buildMetadata({ notionPageId, notionUrl, title });

    return {
      requirementText: rawText,
      source: 'notion',
      ...(metadata !== undefined ? { metadata } : {}),
    };
  }
}

/** Keeps only the metadata fields that were actually provided. */
function buildMetadata({
  notionPageId,
  notionUrl,
  title,
}: {
  notionPageId: string | undefined;
  notionUrl: string | undefined;
  title: string | undefined;
}): NotionRequirementInput['metadata'] | undefined {
  const metadata = {
    ...(notionPageId !== undefined ? { pageId: notionPageId } : {}),
    ...(notionUrl !== undefined ? { url: notionUrl } : {}),
    ...(title !== undefined ? { title } : {}),
  };

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}
