export { DefaultGitDiffReaderTool, DefaultGitInputAdapter } from './git/index.js';
export type {
  GitDiffReaderTool,
  GitDiffReaderInput,
  GitDiffResult,
  GitInputAdapter,
  GitInputAdapterInput,
  GitAnalysisInput,
} from './git/index.js';

export { ManualRequirementInputAdapter } from './requirement/index.js';
export type {
  RequirementInput,
  RequirementInputAdapterInput,
  RequirementInputAdapter,
} from './requirement/index.js';

export {
  DefaultNotionInputAdapter,
  DefaultNotionOutputAdapter,
  createNotionPlugin,
} from './notion/index.js';
export type {
  NotionInputAdapter,
  NotionInputAdapterInput,
  NotionRequirementInput,
  NotionOutputAdapter,
  NotionOutputAdapterInput,
  NotionOutputResult,
  NotionArtifacts,
  NotionPlugin,
} from './notion/index.js';

export {
  DefaultPresentationDeckBuilderTool,
  DefaultPptxDeckBuilderTool,
  buildMarkdownDeck,
  buildPptxDeck,
} from './presentation/index.js';
export type {
  DeckMetadata,
  MarkdownDeckInput,
  MarkdownDeckResult,
  PresentationDeckBuilderTool,
  PptxDeckResult,
  PptxDeckBuilderTool,
} from './presentation/index.js';
