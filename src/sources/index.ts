export type {
  ProjectSourceKind,
  SourceReference,
  NormalizedProjectSource,
  NormalizedProjectContext,
  GitHubPullRequestSource,
  NotionConnector,
  GitHubConnector,
  SourceResponse,
  SourceFetch,
} from './types.js';
export { defaultSourceFetch } from './types.js';

export { buildNormalizedProjectContext } from './buildNormalizedProjectContext.js';
export { formatProjectContextForPrompt } from './formatProjectContextForPrompt.js';
export type { FormatProjectContextOptions } from './formatProjectContextForPrompt.js';
export { resolveExternalSources } from './resolveExternalSources.js';
export { resolveConnectors } from './resolveConnectors.js';
export type { ResolvedConnectors } from './resolveConnectors.js';

export { HttpNotionConnector, extractNotionPageId } from './connectors/HttpNotionConnector.js';
export {
  HttpGitHubConnector,
  toGitHubDiffUrl,
  parseChangedFiles,
} from './connectors/HttpGitHubConnector.js';
export { MockNotionConnector, MockGitHubConnector } from './mocks.js';
