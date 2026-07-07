import type { LanguageModel } from '../../llm/LanguageModel.js';
import type { DemoPrepLoop, DemoPrepLoopInput } from './types.js';
import { buildPrompt } from './prompt.js';
import { parseOutput } from './parseOutput.js';

/**
 * Turns the raw diff, the requirement/spec, and the upstream analysis artifacts
 * into a structured Demo Prep Loop: an approval-gated plan for demoing and
 * presenting the change — story, walkthrough order, code evidence, manual
 * screenshot plan, slide-by-slide deck plan, video script, pitch, and
 * readiness checklist.
 *
 * It is LLM-backed: it reasons over the diff plus the analysis artifacts,
 * marks paths as confirmed vs inferred, keeps every item pending the user's
 * approval, and fails closed on invalid model output. It never captures
 * screenshots and never builds the presentation file itself — the
 * deterministic presentation builder tool does that from the deck plan.
 */
export interface DemoPrepLoopSkill {
  readonly name: string;
  execute(input: DemoPrepLoopInput): Promise<DemoPrepLoop>;
}

export class DefaultDemoPrepLoopSkill implements DemoPrepLoopSkill {
  readonly name = 'demo-prep-loop';

  constructor(private readonly model: LanguageModel) {}

  async execute(input: DemoPrepLoopInput): Promise<DemoPrepLoop> {
    const prompt = buildPrompt(input);
    const { text } = await this.model.generate({ prompt });
    return parseOutput(text);
  }
}
