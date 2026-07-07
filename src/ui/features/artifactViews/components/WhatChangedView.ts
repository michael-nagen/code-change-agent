/** Presentation: the "What Changed" (ChangeExplanation) artifact body. */
import type { ChangeExplanation } from '../../../../skills/changeExplanation/index.js';
import { section, list, paragraph } from './viewHelpers.js';

export function renderChangeExplanation(ce: ChangeExplanation): string {
  const components = ce.mainComponents.map((c) => `${c.name}: ${c.responsibility}`);
  return [
    section('Summary', paragraph(ce.changeStory)),
    section('Key Functionalities', list(ce.keyFunctionalities)),
    section('Flow', list(ce.flow)),
    section('Main Components', list(components)),
    section('Architectural Decisions', list(ce.architecturalDecisions)),
    section('Impact Analysis', list(ce.impactAnalysis)),
    section('Uncertainties', list(ce.uncertainties)),
  ].join('');
}
