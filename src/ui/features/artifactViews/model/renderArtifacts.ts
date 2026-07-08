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
import { renderDailyWorkGuidance } from '../components/DailyWorkGuidanceView.js';
import { renderTechnicalChangeBrief } from '../components/TechnicalChangeBriefView.js';
import { renderDemoPrepLoop } from '../components/DemoPrepLoopView.js';
import { renderWeeklyReview } from '../components/WeeklyReviewView.js';
import type { DailyWorkGuidance } from '../../../../skills/dailyWorkGuidance/index.js';
import type { TechnicalChangeBrief } from '../../../../skills/technicalChangeBrief/index.js';
import type { DemoPrepLoop } from '../../../../skills/demoPrepLoop/index.js';
import type { WeeklyReview } from '../../../../skills/weeklyReview/index.js';
import { buildMarkdownDeck, buildPptxDeck } from '../../../../tools/presentation/index.js';
import {
  prDescriptionToMarkdown,
  dailyWorkGuidanceToMarkdown,
  notionDailyUpdateToMarkdown,
  technicalChangeBriefToMarkdown,
  technicalChangeBriefTalkingPointsToMarkdown,
  technicalChangeBriefFilesToMarkdown,
  demoPrepLoopToMarkdown,
  demoPrepLoopWalkthroughToMarkdown,
  demoPrepLoopScreenshotPlanToMarkdown,
  demoPrepLoopDeckPlanToMarkdown,
  demoPrepLoopSpeakerNotesToMarkdown,
  demoPrepLoopNarrationToMarkdown,
  weeklyReviewToMarkdown,
  weeklyReviewUpdateToMarkdown,
  weeklyReviewDemoStoryToMarkdown,
  weeklyReviewTalkingPointsToMarkdown,
  weeklyReviewNextWeekToMarkdown,
  weeklyReviewMemoryProposalToMarkdown,
} from './copyFormatters.js';

// Re-exported so the package's public surface (`./index.js`) stays unchanged.
export { prDescriptionToMarkdown } from './copyFormatters.js';

/**
 * Extra labeled copy targets for Daily Work Guidance: the Notion-ready daily
 * block, plus one per planned step's Cursor/Claude prompt. The full artifact is
 * offered via the primary `copyText`.
 */
function dailyWorkGuidanceCopyActions(g: DailyWorkGuidance): { label: string; text: string }[] {
  const actions = [
    {
      label: 'Notion daily',
      text: notionDailyUpdateToMarkdown({ update: g.notionDailyUpdate, date: g.memoryUpdate.date }),
    },
  ];
  for (const step of g.plannedSteps) {
    actions.push({ label: `Prompt: ${step.title}`, text: step.cursorPrompt });
  }
  return actions;
}

/**
 * Extra labeled copy targets for the Technical Change Brief: the talking points
 * on their own and the files-worth-showing list. The full brief is offered via
 * the primary `copyText`.
 */
function technicalChangeBriefCopyActions(
  b: TechnicalChangeBrief,
): { label: string; text: string }[] {
  return [
    { label: 'Talking points', text: technicalChangeBriefTalkingPointsToMarkdown(b) },
    { label: 'Files worth showing', text: technicalChangeBriefFilesToMarkdown(b) },
  ];
}

/**
 * Builds the Markdown presentation deck from the structured deck plan via the
 * deterministic presentation builder tool — pure formatting, no reasoning.
 */
function demoPrepLoopDeckMarkdown(x: DemoPrepLoop): string {
  return buildMarkdownDeck({ deckPlan: x.deckPlan, screenshotPlan: x.screenshotPlan });
}

/**
 * Builds the .pptx deck from the same structured deck plan via the
 * deterministic PPTX builder, base64-encoded so it can travel in the JSON
 * card payload to the browser.
 */
function demoPrepLoopDeckPptxBase64(x: DemoPrepLoop): string {
  return Buffer.from(
    buildPptxDeck({ deckPlan: x.deckPlan, screenshotPlan: x.screenshotPlan }),
  ).toString('base64');
}

/**
 * Extra labeled copy targets for the Demo Prep Loop: each plan section on its
 * own, the pitch as raw text, and the generated Markdown deck. The full plan is
 * offered via the primary `copyText`.
 */
function weeklyReviewCopyActions(r: WeeklyReview): { label: string; text: string }[] {
  return [
    { label: 'Weekly update', text: weeklyReviewUpdateToMarkdown(r) },
    { label: 'Demo / video story', text: weeklyReviewDemoStoryToMarkdown(r) },
    { label: 'Talking points', text: weeklyReviewTalkingPointsToMarkdown(r) },
    { label: 'Next week plan', text: weeklyReviewNextWeekToMarkdown(r) },
    { label: 'Memory update proposal', text: weeklyReviewMemoryProposalToMarkdown(r) },
  ];
}

function demoPrepLoopCopyActions(x: DemoPrepLoop): { label: string; text: string }[] {
  return [
    { label: 'Walkthrough order', text: demoPrepLoopWalkthroughToMarkdown(x) },
    { label: 'Screenshot plan', text: demoPrepLoopScreenshotPlanToMarkdown(x) },
    { label: 'Deck plan', text: demoPrepLoopDeckPlanToMarkdown(x) },
    { label: 'Speaker notes', text: demoPrepLoopSpeakerNotesToMarkdown(x) },
    { label: 'Narration script', text: demoPrepLoopNarrationToMarkdown(x) },
    { label: 'Short pitch', text: x.finalShortPitch },
    { label: 'Markdown deck', text: demoPrepLoopDeckMarkdown(x) },
  ];
}

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
  copyActions,
  downloadActions,
}: {
  id: string;
  artifact: T | undefined;
  render: (artifact: T) => string;
  copyText?: (artifact: T) => string;
  copyActions?: (artifact: T) => { label: string; text: string }[];
  downloadActions?: (artifact: T) => NonNullable<WorkspaceCard['downloadActions']>;
}): WorkspaceCard {
  const { label, group } = artifactMetaOf(id);
  if (artifact === undefined) {
    return { id, label, group, state: 'not_generated', html: emptyState(label) };
  }
  const card: WorkspaceCard = { id, label, group, state: 'generated', html: render(artifact) };
  if (copyText !== undefined) {
    card.copyText = copyText(artifact);
  }
  if (copyActions !== undefined) {
    card.copyActions = copyActions(artifact);
  }
  if (downloadActions !== undefined) {
    card.downloadActions = downloadActions(artifact);
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
    makeCard({
      id: 'dailyWorkGuidance',
      artifact: result.dailyWorkGuidance,
      render: renderDailyWorkGuidance,
      copyText: dailyWorkGuidanceToMarkdown,
      copyActions: dailyWorkGuidanceCopyActions,
    }),
    makeCard({
      id: 'technicalChangeBrief',
      artifact: result.technicalChangeBrief,
      render: renderTechnicalChangeBrief,
      copyText: technicalChangeBriefToMarkdown,
      copyActions: technicalChangeBriefCopyActions,
    }),
    makeCard({
      id: 'demoPrepLoop',
      artifact: result.demoPrepLoop,
      render: renderDemoPrepLoop,
      copyText: demoPrepLoopToMarkdown,
      copyActions: demoPrepLoopCopyActions,
      downloadActions: (x) => [
        {
          label: 'Download deck (.md)',
          filename: 'demo-deck.md',
          mimeType: 'text/markdown',
          text: demoPrepLoopDeckMarkdown(x),
        },
        {
          label: 'Download PPTX deck',
          filename: 'demo-deck.pptx',
          mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          base64: demoPrepLoopDeckPptxBase64(x),
        },
      ],
    }),
    makeCard({
      id: 'weeklyReview',
      artifact: result.weeklyReview,
      render: renderWeeklyReview,
      copyText: weeklyReviewToMarkdown,
      copyActions: weeklyReviewCopyActions,
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
