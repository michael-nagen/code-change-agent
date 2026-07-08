/** Public surface of the UI v0 shell layer. */
export type {
  UiMode,
  InputMode,
  FormSubmission,
  NormalizedInput,
  AnalysisRequest,
  AnalysisIncludeSelection,
  AnalysisRunner,
  CardGroup,
  CardState,
  WorkspaceCard,
  AnalysisOverview,
  AnalyzeResponse,
  ChatEditResponse,
  UndoArtifactEditResponse,
  WriteNotionResponse,
} from './types.js';
export { INPUT_MODES } from './types.js';
export { parseFormSubmission, RequestParseError } from './parseRequest.js';
export {
  normalizeInput,
  toGitHubDiffUrl,
  extractReadableText,
  defaultFetch,
} from './normalizeInput.js';
export type { FetchLike, MinimalResponse } from './normalizeInput.js';
export { renderWorkspaceCards, prDescriptionToMarkdown } from './features/artifactViews/index.js';
export { HarnessAnalysisRunner, MockAnalysisRunner } from './analysisRunner.js';
export {
  resolveEngine,
  resolveHarnessSourceDeps,
  resolveNotionWriteBack,
} from './resolveEngine.js';
export type { ResolvedEngine } from './resolveEngine.js';
export { handleAnalyze } from './handleAnalyze.js';
export { handleChatEdit, handleUndoArtifactEdit } from './handleChatEdit.js';
export { handleWriteNotion } from './handleWriteNotion.js';
export {
  UiSessionStore,
  EDITABLE_ARTIFACT_KEYS,
  isEditableArtifactKey,
  getEditableArtifact,
} from './sessionStore.js';
export type { ArtifactVersion } from './sessionStore.js';
export { renderPage } from './page.js';
export { createUiServer, createUiRequestListener } from './server.js';
