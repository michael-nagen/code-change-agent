import { ToolError } from '../../errors/ToolError.js';
import type {
  RequirementInput,
  RequirementInputAdapter,
  RequirementInputAdapterInput,
} from './types.js';

/** No reasoning, no LLM calls, no external I/O. */
export class ManualRequirementInputAdapter implements RequirementInputAdapter {
  readonly name = 'manual-requirement-input';

  async execute({ requirementText }: RequirementInputAdapterInput): Promise<RequirementInput> {
    const trimmed = requirementText.trim();

    if (trimmed.length === 0) {
      throw new ToolError('VALIDATION', 'requirementText must not be empty.');
    }

    return { requirementText: trimmed, source: 'manual' };
  }
}
