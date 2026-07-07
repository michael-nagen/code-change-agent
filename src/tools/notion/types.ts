/**
 * Notion plugin types.
 *
 * Notion is a plugin/adapter layer only. The input adapter acquires requirement
 * text; the output adapter formats already-produced artifacts into text. Neither
 * analyzes, summarizes, interprets, ranks, or reasons about content — all
 * reasoning stays inside skills.
 */
import type { ChangeExplanation } from '../../skills/changeExplanation/index.js';
import type { RequirementAlignment } from '../../skills/requirementAlignment/index.js';
import type { GapReport } from '../../skills/gapReport/index.js';
import type { FlowArtifact } from '../../skills/flowGeneration/index.js';
import type { PRDescription } from '../../skills/prDescription/index.js';
import type { VideoScript } from '../../skills/videoScript/index.js';
import type { DailyUpdate } from '../../skills/dailyUpdate/index.js';

/** Input accepted by the NotionInputAdapter. */
export interface NotionInputAdapterInput {
  notionPageId?: string;
  notionUrl?: string;
  rawText?: string;
  title?: string;
}

/**
 * Normalized requirement input acquired from Notion. `source` is a discriminant
 * mirroring the other input adapters; `requirementText` is preserved verbatim.
 */
export interface NotionRequirementInput {
  requirementText: string;
  source: 'notion';
  metadata?: {
    pageId?: string;
    url?: string;
    title?: string;
  };
}

/**
 * An input adapter that acquires requirement text from a Notion-like source.
 * Implementations must not analyze, summarize, or call a skill/LLM.
 */
export interface NotionInputAdapter {
  readonly name: string;
  execute(input: NotionInputAdapterInput): Promise<NotionRequirementInput>;
}

/** The artifacts the output adapter can format. Any subset may be provided. */
export interface NotionArtifacts {
  changeExplanation?: ChangeExplanation;
  requirementAlignment?: RequirementAlignment;
  gapReport?: GapReport;
  flowArtifact?: FlowArtifact;
  prDescription?: PRDescription;
  videoScript?: VideoScript;
  dailyUpdate?: DailyUpdate;
}

export interface NotionOutputAdapterInput {
  notionPageId?: string;
  notionUrl?: string;
  artifacts: NotionArtifacts;
}

export interface NotionOutputResult {
  source: 'notion';
  destination: {
    pageId?: string;
    url?: string;
  };
  /** Artifact keys that were formatted into the content, in canonical order. */
  writtenSections: string[];
  /** The exact text that would be written to Notion. */
  content: string;
}

/**
 * An output adapter that formats existing artifacts into Notion-ready text.
 * Implementations must not analyze or reinterpret artifacts, and must never hide
 * gaps, risks, missing items, or unclear items.
 */
export interface NotionOutputAdapter {
  readonly name: string;
  execute(input: NotionOutputAdapterInput): Promise<NotionOutputResult>;
}

/**
 * A bidirectional plugin: a paired input + output adapter. Mirrors the intended
 * future shape of other source plugins (e.g. GitPlugin.input / GitPlugin.output).
 */
export interface NotionPlugin {
  input: NotionInputAdapter;
  output: NotionOutputAdapter;
}
