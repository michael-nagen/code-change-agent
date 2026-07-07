/**
 * Types for the ChangeExplanationSkill.
 *
 * Input: a raw git diff only. The skill does NOT receive a requirement —
 * requirement alignment is the responsibility of a separate future skill.
 *
 * Output: a structured knowledge object. Not markdown, not a report.
 * Downstream generators (reports, PR descriptions, video scripts, ...) consume
 * this object rather than re-analyzing the raw diff.
 */

export interface ChangeExplanationInput {
  diff: string;
}

export interface ChangeExplanation {
  /**
   * A concise narrative explaining the change in terms of system behavior.
   * A developer should understand the overall change within seconds.
   */
  changeStory: string;

  /**
   * The most important capabilities introduced or modified.
   * Focus on capabilities, not code volume or file names.
   */
  keyFunctionalities: string[];

  /**
   * Ordered steps describing the runtime flow after the change.
   * Each step is a short, human-readable label.
   */
  flow: string[];

  /**
   * The most important components involved in the change.
   * Each entry has a name and a one-sentence responsibility.
   */
  mainComponents: {
    name: string;
    responsibility: string;
  }[];

  /**
   * Important design/architectural choices visible in the diff.
   * Focus on decisions, not implementation details.
   */
  architecturalDecisions: string[];

  /**
   * System areas affected by this change.
   * Include major areas NOT affected when inferable.
   */
  impactAnalysis: string[];

  /**
   * Information that cannot be confidently determined from the diff alone.
   * Prefer explicit uncertainty over hallucination.
   */
  uncertainties: string[];
}
