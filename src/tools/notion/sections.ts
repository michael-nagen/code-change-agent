/**
 * Faithful artifact-to-markdown formatters.
 *
 * These render exactly what each artifact contains — including gaps, risks,
 * missing, partial, and unclear items. They add no analysis and invent nothing:
 * if a list is empty, the section says so rather than omitting the concern.
 */
import type { ChangeExplanation } from '../../skills/changeExplanation/index.js';
import type { RequirementAlignment } from '../../skills/requirementAlignment/index.js';
import type { GapReport } from '../../skills/gapReport/index.js';
import type { FlowArtifact } from '../../skills/flowGeneration/index.js';
import type { PRDescription } from '../../skills/prDescription/index.js';
import type { VideoScript } from '../../skills/videoScript/index.js';
import type { DailyUpdate } from '../../skills/dailyUpdate/index.js';

export function formatChangeExplanation(changeExplanation: ChangeExplanation): string {
  return [
    '## Change Explanation',
    paragraph(changeExplanation.changeStory),
    list({ heading: 'Key functionalities', items: changeExplanation.keyFunctionalities }),
    list({ heading: 'Runtime flow', items: changeExplanation.flow }),
    list({
      heading: 'Main components',
      items: changeExplanation.mainComponents.map((c) => `${c.name}: ${c.responsibility}`),
    }),
    list({ heading: 'Architectural decisions', items: changeExplanation.architecturalDecisions }),
    list({ heading: 'Impact analysis', items: changeExplanation.impactAnalysis }),
    list({ heading: 'Uncertainties', items: changeExplanation.uncertainties }),
  ].join('\n\n');
}

export function formatRequirementAlignment(requirementAlignment: RequirementAlignment): string {
  return [
    '## Requirement Alignment',
    paragraph(requirementAlignment.requirementSummary),
    list({ heading: 'Satisfied', items: requirementAlignment.satisfiedItems }),
    list({ heading: 'Partially satisfied', items: requirementAlignment.partiallySatisfiedItems }),
    list({ heading: 'Missing', items: requirementAlignment.missingItems }),
    list({ heading: 'Unclear', items: requirementAlignment.unclearItems }),
    paragraph(`Overall assessment: ${requirementAlignment.overallAssessment}`),
    paragraph(`Confidence: ${requirementAlignment.confidence}`),
  ].join('\n\n');
}

export function formatGapReport(gapReport: GapReport): string {
  return [
    '## Gap Report',
    paragraph(`Readiness: ${gapReport.readiness}`),
    list({ heading: 'Completed work', items: gapReport.completedWork }),
    list({ heading: 'Remaining gaps', items: gapReport.remainingGaps }),
    list({ heading: 'Partial items', items: gapReport.partialItems }),
    list({ heading: 'Unclear items', items: gapReport.unclearItems }),
    list({ heading: 'Risks', items: gapReport.risks }),
    list({ heading: 'Recommended next actions', items: gapReport.recommendedNextActions }),
    paragraph(`PR recommendation: ${gapReport.prRecommendation}`),
  ].join('\n\n');
}

export function formatFlowArtifact(flowArtifact: FlowArtifact): string {
  return [
    `## Feature Flow: ${flowArtifact.title}`,
    paragraph(flowArtifact.description),
    list({ heading: 'Steps', items: flowArtifact.steps }),
    codeBlock({ language: 'mermaid', body: flowArtifact.mermaid }),
  ].join('\n\n');
}

export function formatPRDescription(prDescription: PRDescription): string {
  return [
    `## PR Description: ${prDescription.title}`,
    paragraph(prDescription.summary),
    list({ heading: 'What changed', items: prDescription.whatChanged }),
    list({ heading: 'Requirement coverage', items: prDescription.requirementCoverage }),
    paragraph(prDescription.featureFlow),
    list({ heading: 'Testing notes', items: prDescription.testingNotes }),
    list({ heading: 'Risks and follow-ups', items: prDescription.risksAndFollowUps }),
  ].join('\n\n');
}

export function formatVideoScript(videoScript: VideoScript): string {
  const sectionLines = videoScript.sections.map((section) =>
    [
      `### ${section.title}`,
      paragraph(section.narration),
      paragraph(`Visual cue: ${section.visualCue}`),
    ].join('\n\n'),
  );

  return [
    `## Video Script: ${videoScript.title}`,
    paragraph(`Target audience: ${videoScript.targetAudience}`),
    paragraph(`Estimated duration: ${videoScript.estimatedDuration}`),
    ...sectionLines,
    list({ heading: 'Key takeaways', items: videoScript.keyTakeaways }),
  ].join('\n\n');
}

export function formatDailyUpdate(dailyUpdate: DailyUpdate): string {
  return [
    '## Daily Update',
    paragraph(dailyUpdate.headline),
    list({ heading: 'Yesterday', items: dailyUpdate.yesterdaySummary }),
    list({ heading: 'Today', items: dailyUpdate.todaySuggestions }),
    list({ heading: 'Blockers or risks', items: dailyUpdate.blockersOrRisks }),
    paragraph(
      `Highlighted topic — ${dailyUpdate.highlightedTopic.title}: ${dailyUpdate.highlightedTopic.explanation} (${dailyUpdate.highlightedTopic.whyItMatters})`,
    ),
    paragraph(`Spoken version: ${dailyUpdate.spokenVersion}`),
  ].join('\n\n');
}

function paragraph(text: string): string {
  return text.trim();
}

/** An empty list is reported explicitly so a concern is never silently dropped. */
function list({ heading, items }: { heading: string; items: string[] }): string {
  if (items.length === 0) {
    return `**${heading}:** none`;
  }
  const bullets = items.map((item) => `- ${item}`).join('\n');
  return `**${heading}:**\n${bullets}`;
}

function codeBlock({ language, body }: { language: string; body: string }): string {
  return `\`\`\`${language}\n${body}\n\`\`\``;
}
