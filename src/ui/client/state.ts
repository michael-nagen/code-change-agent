/**
 * Client app: the state shape, its defaults, and the static constant tables.
 *
 * This fragment owns *data only* — no DOM access, no rendering, no network. The
 * artifact tables (BASE/OUTPUTS/GROUP_OF/FLAG_OF/DEPS/HELP/EDITABLE) are
 * generated from the shared ARTIFACT_METADATA, never hand-maintained here.
 *
 * Emitted as an array of source lines (no template literals/backticks) because
 * the whole client script is embedded inside a TS template literal in page.ts.
 */
import { clientArtifactConstantLines } from '../artifacts/artifactMetadata.client.js';

export const STATE_LINES: string[] = [
  "var MODES = ['manual','githubUrl','websiteContextUrl','notionText'];",
  "var MODE_DESC = {",
  "  manual: 'Paste a requirement and raw git diff.',",
  "  githubUrl: \"Paste a public GitHub PR or commit URL. We'll fetch the diff automatically.\",",
  "  websiteContextUrl: 'Paste a product/spec/documentation URL as context. You still need to provide the code diff.',",
  "  notionText: 'Paste copied/exported Notion content. Real Notion OAuth will come later.'",
  "};",
  "var LOADING_STEPS = [",
  "  'Understanding the code change…',",
  "  'Checking it against the requirement…',",
  "  'Preparing your analysis workspace…'",
  "];",
  ...clientArtifactConstantLines(),
  "var STATUS_LABELS = { generated:'Generated', not_generated:'Not generated', generating:'Generating', error:'Error' };",
  "var CHAT_HELP = 'Ask for edits to this artifact. Changes will update the selected text.';",
  "",
  "var state = { sessionId: null, mode: null, inputs: null, overview: null, cards: {}, override: {}, errors: {}, selected: 'overview', ready: false, chatMessages: {}, canUndo: {}, chatLoading: false };",
  "var loadingTimer = null;",
  "",
];
