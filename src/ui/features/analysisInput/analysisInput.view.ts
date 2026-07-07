/**
 * Composes the input area: a display-only project card and the "Source &
 * requirement" card that holds the source-mode selector, the four mode-specific
 * forms, and the single "Run Initial Analysis" button.
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

${runAnalysisButton()}
  </div>`;
}
