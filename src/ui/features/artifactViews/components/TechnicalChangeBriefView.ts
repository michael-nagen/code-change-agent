/** Presentation: the "Technical Change Brief" artifact body. */
import type {
  DataSchemaChanges,
  FileWorthShowing,
  HowItWorksStep,
  InputApiFlag,
  InterestingFunctionality,
  ModelOrType,
  SchemaChangeItem,
  TechnicalChangeBrief,
  UiChanges,
  WorkflowRuntimeChanges,
} from '../../../../skills/technicalChangeBrief/index.js';
import { escapeHtml } from '../../../escapeHtml.js';
import { section, list, paragraph } from './viewHelpers.js';

function evidenceTag(evidence: string): string {
  return `<span class="status-tag">${escapeHtml(evidence)}</span>`;
}

function withPath(name: string, filePath?: string): string {
  const at =
    filePath !== undefined ? ` <span class="muted">(${escapeHtml(filePath)})</span>` : '';
  return `<strong>${escapeHtml(name)}</strong>${at}`;
}

function renderSchemaGroup(title: string, items: SchemaChangeItem[]): string {
  if (items.length === 0) return '';
  const rows = items
    .map(
      (item) =>
        `<li>${withPath(item.name, item.filePath)} ${evidenceTag(item.evidence)}` +
        `<div class="muted">${escapeHtml(item.description)}</div></li>`,
    )
    .join('');
  return `<p class="muted"><strong>${escapeHtml(title)}</strong></p><ul>${rows}</ul>`;
}

function renderDataSchemaChanges(d: DataSchemaChanges): string {
  if (!d.hasChanges) {
    return paragraph(d.summary);
  }
  return (
    paragraph(d.summary) +
    renderSchemaGroup('New fields', d.newFields) +
    renderSchemaGroup('Changed fields', d.changedFields) +
    renderSchemaGroup('Removed fields', d.removedFields) +
    renderSchemaGroup('New schemas', d.newSchemas) +
    renderSchemaGroup('Changed parser contracts', d.changedParserContracts) +
    renderSchemaGroup('New status values / enums', d.newStatusValues) +
    `<p class="muted"><strong>Persisted/session data impact:</strong> ${escapeHtml(d.persistedDataImpact)}</p>` +
    `<p class="muted"><strong>Backward compatibility:</strong> ${evidenceTag(d.backwardCompatibility)} ${escapeHtml(d.backwardCompatibilityNote)}</p>`
  );
}

function renderModel(m: ModelOrType): string {
  return (
    `<li>${withPath(m.name, m.filePath)} ${evidenceTag(m.evidence)}` +
    `<div class="muted">Represents: ${escapeHtml(m.represents)}</div>` +
    `<div class="muted">Why needed: ${escapeHtml(m.whyNeeded)}</div>` +
    `<div class="muted">Important fields:</div>${list(m.importantFields)}</li>`
  );
}

function renderInputApiFlag(i: InputApiFlag): string {
  return (
    `<li>${evidenceTag(i.kind)} ${withPath(i.name, i.filePath)} ${evidenceTag(i.evidence)}` +
    `<div class="muted">${escapeHtml(i.description)}</div></li>`
  );
}

function renderWorkflowRuntime(w: WorkflowRuntimeChanges): string {
  return (
    paragraph(w.summary) +
    `<p class="muted"><strong>Where it runs:</strong> ${escapeHtml(w.whereItRuns)}</p>` +
    `<p class="muted"><strong>Depends on:</strong></p>${list(w.dependsOn)}` +
    `<p class="muted"><strong>Consumes:</strong></p>${list(w.consumesArtifacts)}` +
    `<p class="muted"><strong>Produces:</strong> ${escapeHtml(w.producesArtifact)}</p>` +
    `<p class="muted"><strong>Cached / reused:</strong> ${escapeHtml(w.cachedOrReused)}</p>` +
    `<p class="muted"><strong>When the flag is off:</strong> ${escapeHtml(w.behaviorWhenFlagOff)}</p>`
  );
}

function renderUiChanges(u: UiChanges): string {
  if (!u.hasChanges) {
    return paragraph(u.summary);
  }
  return (
    paragraph(u.summary) +
    `<p class="muted"><strong>New cards / views:</strong></p>${list(u.newCardsOrViews)}` +
    `<p class="muted"><strong>Toggles / buttons:</strong></p>${list(u.togglesOrButtons)}` +
    `<p class="muted"><strong>Copy actions:</strong></p>${list(u.copyActions)}` +
    `<p class="muted"><strong>Sections displayed:</strong></p>${list(u.sectionsDisplayed)}` +
    `<p class="muted"><strong>How to activate:</strong> ${escapeHtml(u.howToActivate)}</p>`
  );
}

function renderInteresting(f: InterestingFunctionality): string {
  return (
    `<section class="artifact-section"><h5>${escapeHtml(f.title)}</h5>` +
    `<p class="muted"><strong>What it does:</strong> ${escapeHtml(f.whatItDoes)}</p>` +
    `<p class="muted"><strong>Why it matters:</strong> ${escapeHtml(f.whyItMatters)}</p>` +
    `<p class="muted"><strong>How it works:</strong> ${escapeHtml(f.howItWorks)}</p>` +
    `<p class="muted"><strong>Files:</strong></p>${list(f.filesInvolved)}</section>`
  );
}

function renderStep(step: HowItWorksStep): string {
  const actor = step.actor !== undefined ? `<strong>${escapeHtml(step.actor)}:</strong> ` : '';
  const detail =
    step.detail !== undefined ? ` <span class="muted">— ${escapeHtml(step.detail)}</span>` : '';
  return `<li>${actor}${escapeHtml(step.action)}${detail}</li>`;
}

function renderFile(f: FileWorthShowing): string {
  return (
    `<li><strong>${escapeHtml(f.path)}</strong>` +
    `<div class="muted">Why it matters: ${escapeHtml(f.whyItMatters)}</div>` +
    `<div class="muted">Point out: ${escapeHtml(f.whatToPointOut)}</div></li>`
  );
}

export function renderTechnicalChangeBrief(b: TechnicalChangeBrief): string {
  const models =
    b.modelsAndTypes.length === 0
      ? `<p class="muted">No models or types highlighted.</p>`
      : `<ul>${b.modelsAndTypes.map(renderModel).join('')}</ul>`;
  const inputs =
    b.inputsApiFlags.length === 0
      ? `<p class="muted">No new inputs, API changes, or flags.</p>`
      : `<ul>${b.inputsApiFlags.map(renderInputApiFlag).join('')}</ul>`;
  const interesting =
    b.interestingFunctionality.length === 0
      ? `<p class="muted">Nothing highlighted.</p>`
      : b.interestingFunctionality.map(renderInteresting).join('');
  const steps =
    b.howItWorksStepByStep.length === 0
      ? `<p class="muted">No step-by-step flow provided.</p>`
      : `<ol>${b.howItWorksStepByStep.map(renderStep).join('')}</ol>`;
  const files =
    b.filesWorthShowing.length === 0
      ? `<p class="muted">No files highlighted.</p>`
      : `<ul>${b.filesWorthShowing.map(renderFile).join('')}</ul>`;

  return [
    section('Executive Summary', paragraph(b.executiveSummary)),
    section('Data / Schema Changes', renderDataSchemaChanges(b.dataSchemaChanges)),
    section('Models & Types', models),
    section('Inputs / API / Flags', inputs),
    section('Workflow / Runtime Changes', renderWorkflowRuntime(b.workflowRuntimeChanges)),
    section('UI Changes', renderUiChanges(b.uiChanges)),
    section('Interesting Functionality Deep Dive', interesting),
    section('How It Works Step-by-Step', steps),
    section('Files Worth Showing', files),
    section('Talking Points', list(b.talkingPoints)),
  ].join('');
}
