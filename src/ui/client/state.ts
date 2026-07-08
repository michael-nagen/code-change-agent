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
  "var PREF_LIST_KEYS = ['cursor','claudeCode','codeReview','dailyUpdate','weeklyReview','demoVideo','mentorUpdate'];",
  "var PREF_CAT_LABELS = { cursor:'Cursor prompt preferences', claudeCode:'Claude Code prompt preferences', codeReview:'Code review preferences', dailyUpdate:'Daily update preferences', weeklyReview:'Weekly review preferences', demoVideo:'Demo / video preferences', mentorUpdate:'Mentor / manager update preferences' };",
  "var PREF_DISCLAIMER = 'Preferences shape FORMAT / STYLE / WORKFLOW only — never facts grounded in the spec, diff, or analysis.';",
  // Story-driven left nav: each section lists item ids in display order; virtual
  // views (overview / projectMemory / sources / safety) sit beside real artifacts.
  "var NAV_SECTIONS = [",
  "  { title: '', ids: ['overview'] },",
  "  { title: 'Daily companion', ids: ['dailyWorkGuidance','weeklyReview'] },",
  "  { title: 'Understand the change', ids: ['changeExplanation','requirementAlignment','gapReport','flowArtifact'] },",
  "  { title: 'Communicate & present', ids: ['technicalChangeBrief','demoPrepLoop','prDescription','videoScript','dailyUpdate'] },",
  "  { title: 'Project & context', ids: ['projectMemory','sources','safety'] }",
  "];",
  "var FLOW_STEPS = ['Spec + diff','Daily Work Guidance','Plan self-review','Approve / revise','Model re-plan','Memory saved'];",
  "var LOOP_STAGE_LABELS = { planning: 'Planning — your approval', revised_plan_pending_approval: 'Revised plan — pending approval', approved_plan: 'Approved plan' };",
  "var SOURCE_KIND_LABELS = { manual: 'Manual input', memory: 'Project memory', github: 'GitHub', notion: 'Notion', daily: 'Daily guidance', weekly: 'Weekly review', technical_brief: 'Technical brief', demo_prep: 'Demo prep' };",
  "var VIEW_HELP = { sources: 'Where this run got its context — manual input, memory, and configured GitHub / Notion sources.', safety: 'How the companion keeps you in control and treats untrusted content as data.' };",
  "var SAFETY_NOTES = [",
  "  'Untrusted source content (GitHub, Notion, websites) is fenced and treated as data, never as instructions.',",
  "  'The model cannot approve its own plan — every step and decision returns as pending approval for you.',",
  "  'Revised steps from re-planning always come back as pending approval; approved and deferred items are preserved.',",
  "  'LLM calls are bounded by an explicit timeout and max tokens, and invalid model output fails closed (no partial writes).',",
  "  'A Telegram command channel can drive this companion when configured; it stays off unless you set it up.'",
  "];",
  "",
  "var state = { sessionId: null, mode: null, inputs: null, overview: null, memory: null, sources: null, memoryEditing: false, cards: {}, override: {}, errors: {}, selected: 'overview', ready: false, chatMessages: {}, canUndo: {}, chatLoading: false };",
  "var loadingTimer = null;",
  "",
];
