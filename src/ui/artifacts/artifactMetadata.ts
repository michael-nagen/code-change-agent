/**
 * Single source of truth for artifact UI definitions.
 *
 * Everything the UI needs to talk about an artifact — its label, group, help
 * text, ordering, include flag, dependencies, editability, copy/chat affordances
 * — lives here, once. Both sides derive from it:
 *   - the server-side card renderer (`renderArtifacts.ts`) reads label/group;
 *   - the inline browser app (`client/*`) gets its constant tables
 *     (BASE/OUTPUTS/GROUP_OF/FLAG_OF/DEPS/HELP/EDITABLE) generated from this list
 *     by `artifactMetadata.client.ts`.
 *
 * So product strings like "PR Draft" or "Feature Flow" exist in exactly one
 * place and can never drift between server and client.
 *
 * `rawJson` is intentionally NOT here: it is a debug-only view, not a product
 * artifact, and is handled separately by `renderWorkspaceCards`.
 */
import type { CardGroup } from '../types.js';

/** A product artifact's group. Excludes the debug-only `rawJson` group. */
export type ArtifactGroup = Exclude<CardGroup, 'debug'>;

/** UI definition for one product artifact. */
export interface ArtifactMeta {
  /** Stable artifact key, e.g. 'changeExplanation', 'prDescription'. */
  readonly key: string;
  /** Friendly, product-facing label, e.g. 'What Changed', 'PR Draft'. */
  readonly label: string;
  /** Which workspace group this artifact belongs to. */
  readonly group: ArtifactGroup;
  /** One-line description shown in the panel header and nav help. */
  readonly description: string;
  /** True for base-analysis artifacts (run on initial analysis). */
  readonly isBaseArtifact: boolean;
  /** True for the optional outputs generated later, on demand. */
  readonly isGeneratedOnDemand: boolean;
  /** True when the artifact supports side-chat editing. */
  readonly isEditable: boolean;
  /** Label for the copy-to-clipboard action, when the artifact offers one. */
  readonly copyLabel?: string;
  /** Title shown above the side chat, when the artifact is chat-editable. */
  readonly chatTitle?: string;
  /** Friendly empty-state line shown before the artifact is generated. */
  readonly emptyStateText?: string;
  /** The `/api/analyze` include flag that generates this artifact, when one exists. */
  readonly flag?: string;
  /** Other artifact keys that must be generated for this one to be produced. */
  readonly requiredDependencies?: readonly string[];
}

/**
 * The product artifacts in display order: base understanding artifacts first,
 * then the on-demand communication outputs.
 */
export const ARTIFACT_METADATA: readonly ArtifactMeta[] = [
  {
    key: 'changeExplanation',
    label: 'What Changed',
    group: 'understanding',
    description: 'A plain-language explanation of what this change does.',
    isBaseArtifact: true,
    isGeneratedOnDemand: false,
    isEditable: false,
  },
  {
    key: 'requirementAlignment',
    label: 'Requirement Check',
    group: 'understanding',
    description: 'How well the change matches the stated requirement.',
    isBaseArtifact: true,
    isGeneratedOnDemand: false,
    isEditable: false,
  },
  {
    key: 'gapReport',
    label: 'PR Readiness',
    group: 'understanding',
    description: 'Whether this is ready to open as a PR, and what is missing.',
    isBaseArtifact: true,
    isGeneratedOnDemand: false,
    isEditable: false,
    flag: 'includeGapReport',
  },
  {
    key: 'flowArtifact',
    label: 'Feature Flow',
    group: 'understanding',
    description: 'The runtime flow this change introduces.',
    isBaseArtifact: true,
    isGeneratedOnDemand: false,
    isEditable: false,
    flag: 'includeFlow',
  },
  {
    key: 'prDescription',
    label: 'PR Draft',
    group: 'actions',
    description: 'A ready-to-paste pull request description.',
    isBaseArtifact: false,
    isGeneratedOnDemand: true,
    isEditable: true,
    copyLabel: 'PR Draft',
    chatTitle: 'PR Draft',
    flag: 'includePrDescription',
    requiredDependencies: ['flowArtifact', 'gapReport'],
  },
  {
    key: 'videoScript',
    label: 'Walkthrough Script',
    group: 'actions',
    description: 'A short spoken walkthrough script.',
    isBaseArtifact: false,
    isGeneratedOnDemand: true,
    isEditable: true,
    chatTitle: 'Walkthrough Script',
    flag: 'includeVideoScript',
    requiredDependencies: ['flowArtifact', 'gapReport'],
  },
  {
    key: 'dailyUpdate',
    label: 'Daily Prep',
    group: 'actions',
    description: 'A standup-ready summary of progress for your team.',
    isBaseArtifact: false,
    isGeneratedOnDemand: true,
    isEditable: true,
    chatTitle: 'Daily Prep',
    flag: 'includeDailyUpdate',
    requiredDependencies: ['flowArtifact', 'gapReport', 'prDescription'],
  },
  {
    key: 'dailyWorkGuidance',
    label: 'Daily Work Guidance',
    group: 'actions',
    description:
      'How to work today: yesterday vs the spec, blockers, decisions, and an approvable plan.',
    isBaseArtifact: false,
    isGeneratedOnDemand: true,
    isEditable: false,
    copyLabel: 'Daily Work Guidance',
    flag: 'includeDailyWorkGuidance',
    requiredDependencies: ['flowArtifact', 'gapReport'],
  },
  {
    key: 'technicalChangeBrief',
    label: 'Technical Change Brief',
    group: 'actions',
    description:
      'A technical explanation of what changed — schema, models, APIs, workflow, UI, and talking points.',
    isBaseArtifact: false,
    isGeneratedOnDemand: true,
    isEditable: false,
    copyLabel: 'Technical Change Brief',
    flag: 'includeTechnicalChangeBrief',
  },
  {
    key: 'demoPrepLoop',
    label: 'Demo Prep Loop',
    group: 'actions',
    description:
      'A demo and presentation plan: story, walkthrough order, screenshots, deck, script, and pitch — all pending your approval.',
    isBaseArtifact: false,
    isGeneratedOnDemand: true,
    isEditable: false,
    copyLabel: 'Demo Prep Loop',
    flag: 'includeDemoPrepLoop',
  },
  {
    key: 'weeklyReview',
    label: 'Weekly Review',
    group: 'actions',
    description:
      'The weekly synthesis: progress vs spec, technical changes, decisions, the demo/video story, and next week.',
    isBaseArtifact: false,
    isGeneratedOnDemand: true,
    isEditable: false,
    copyLabel: 'Weekly Review',
    flag: 'includeWeeklyReview',
  },
];

/** Help text for the non-artifact Overview view. */
export const OVERVIEW_HELP = 'A quick summary of readiness and recommended next steps.';

/** Look up the metadata for an artifact key, throwing if it is unknown. */
export function artifactMetaOf(key: string): ArtifactMeta {
  const meta = ARTIFACT_METADATA.find((m) => m.key === key);
  if (meta === undefined) {
    throw new Error(`Unknown artifact key: ${key}`);
  }
  return meta;
}
