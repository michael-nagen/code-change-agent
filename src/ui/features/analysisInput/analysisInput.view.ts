/**
 * Composes the input area: a project card and the "Source & requirement" card
 * that holds the source-mode selector, the four mode-specific forms, and the
 * "Run Initial Analysis" + "Save project context" buttons.
 *
 * This area is the fallback / setup surface. The everyday flow runs from the
 * Project Command Center (one click); "Save project context" writes the current
 * inputs to the browser so the Command Center can reuse them without re-pasting.
 */
import { projectCard } from './components/ProjectCard.js';
import { sourceModeSelect } from './components/SourceModeSelect.js';
import { manualForm } from './components/ManualForm.js';
import { githubForm } from './components/GithubForm.js';
import { websiteForm } from './components/WebsiteForm.js';
import { notionForm } from './components/NotionForm.js';
import { runAnalysisButton } from './components/RunAnalysisButton.js';

/** The full input area (project card + source/requirement card). */
export function analysisInput(): string {
  return `${projectCard()}

  <div class="card">
    <h2>Source &amp; requirement</h2>
${sourceModeSelect()}

${manualForm()}

${githubForm()}

${websiteForm()}

${notionForm()}

    <div class="input-actions">
${runAnalysisButton()}
      <button type="button" id="save-context-btn" class="btn btn-soft">Save project context</button>
    </div>
  </div>`;
}
