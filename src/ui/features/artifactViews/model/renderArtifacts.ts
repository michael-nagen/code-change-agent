/**
 * Assembles an `AnalysisResult` into Analysis Workspace cards.
 *
 * Each card pairs a product artifact with its UI metadata (label/group from
 * `artifactMetadata.ts`), a state (generated vs. a friendly "not generated
 * yet"), pre-rendered HTML (from the per-artifact view components), and — only
 * for the PR Draft — copyable plain text (from `copyFormatters.ts`).
 *
 * State is derived purely from artifact presence in the result. We never claim
 * incremental/regenerate behavior the backend does not have: absent artifacts
 * are shown as a friendly empty state, not an error.
 */
import type { AnalysisResult } from '../../../../analysis/index.js';
import type { WorkspaceCard } from '../../../types.js';
import { escapeHtml } from '../../../escapeHtml.js';
import { artifactMetaOf } from '../../../artifacts/artifactMetadata.js';
import { codeBlock } from '../components/viewHelpers.js';
import { renderChangeExplanation } from '../components/WhatChangedView.js';
import { renderRequirementAlignment } from '../components/RequirementCheckView.js';
import { renderGapReport } from '../components/PrReadinessView.js';
import { renderFlow } from '../components/FeatureFlowView.js';
import { renderPrDescription } from '../components/PrDraftView.js';
import { renderVideoScript } from '../components/WalkthroughScriptView.js';
import { renderDailyUpdate } from '../components/DailyPrepView.js';
import { prDescriptionToMarkdown } from './copyFormatters.js';

// Re-exported so the package's public surface (`./index.js`) stays unchanged.
export { prDescriptionToMarkdown } from './copyFormatters.js';

function emptyState(label: string): string {
  return `<p class="muted">${escapeHtml(label)} hasn't been generated yet.</p>`;
}

function renderRawJson(result: AnalysisResult): string {
  return codeBlock(JSON.stringify(result, null, 2));
}

/**
 * Build a card from an optional artifact. Label/group come from the shared
 * metadata; present → generated with rendered body; absent → friendly
 * not-generated empty state. `copyText` is attached only when provided and the
 * artifact exists.
 */
function makeCard<T>({
  id,
  artifact,
  render,
  copyText,
}: {
  id: string;
  artifact: T | undefined;
  render: (artifact: T) => string;
  copyText?: (artifact: T) => string;
}): WorkspaceCard {
  const { label, group } = artifactMetaOf(id);
  if (artifact === undefined) {
    return { id, label, group, state: 'not_generated', html: emptyState(label) };
  }
  const card: WorkspaceCard = { id, label, group, state: 'generated', html: render(artifact) };
  if (copyText !== undefined) {
    card.copyText = copyText(artifact);
  }
  return card;
}

/**
 * Render the full Analysis Workspace as an ordered list of cards:
 * Understanding (What Changed, Requirement Check, PR Readiness, Feature Flow),
 * Actions (PR Draft, Walkthrough Script, Daily Prep), and a debug Raw JSON card.
 */
export function renderWorkspaceCards(result: AnalysisResult): WorkspaceCard[] {
  return [
    makeCard({
      id: 'changeExplanation',
      artifact: result.changeExplanation,
      render: renderChangeExplanation,
    }),
    makeCard({
      id: 'requirementAlignment',
      artifact: result.requirementAlignment,
      render: renderRequirementAlignment,
    }),
    makeCard({
      id: 'gapReport',
      artifact: result.gapReport,
      render: renderGapReport,
    }),
    makeCard({
      id: 'flowArtifact',
      artifact: result.flowArtifact,
      render: renderFlow,
    }),
    makeCard({
      id: 'prDescription',
      artifact: result.prDescription,
      render: renderPrDescription,
      copyText: prDescriptionToMarkdown,
    }),
    makeCard({
      id: 'videoScript',
      artifact: result.videoScript,
      render: renderVideoScript,
    }),
    makeCard({
      id: 'dailyUpdate',
      artifact: result.dailyUpdate,
      render: renderDailyUpdate,
    }),
    {
      id: 'rawJson',
      label: 'Raw JSON',
      group: 'debug',
      state: 'generated',
      html: renderRawJson(result),
    },
  ];
}
