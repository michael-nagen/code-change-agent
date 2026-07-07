/**
 * Requirement input adapter types.
 *
 * Adapters acquire and normalize requirement text. They contain no reasoning —
 * the ChangeExplanationSkill must not care how the requirement was obtained.
 */

/**
 * A normalized requirement input produced by any requirement adapter.
 *
 * `source` is a discriminant: 'manual' today; future values ('jira', 'github',
 * 'notion', ...) extend the union without breaking existing consumers.
 */
export interface RequirementInput {
  requirementText: string;
  source: 'manual';
}

/** Input accepted by any RequirementInputAdapter. */
export interface RequirementInputAdapterInput {
  requirementText: string;
}

/**
 * An adapter that acquires or normalizes requirement text into RequirementInput.
 * Implementations must not analyze, summarize, or call an LLM.
 */
export interface RequirementInputAdapter {
  readonly name: string;
  execute(input: RequirementInputAdapterInput): Promise<RequirementInput>;
}
