/**
 * Public surface of the artifactViews feature: turn an AnalysisResult into
 * workspace cards, and the PR markdown copy formatter (re-exported for the UI
 * package's public surface).
 */
export { renderWorkspaceCards, prDescriptionToMarkdown } from './model/renderArtifacts.js';
export { summarizeGuidance } from './model/guidanceSummary.js';
