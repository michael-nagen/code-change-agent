/**
 * Types for the Work Request Intent skill: turning a free-text developer message
 * ("what's blocking me on checkout?", "run the daily prep") into a structured
 * action the existing workflow already understands. The skill only INTERPRETS;
 * routing that action to a concrete channel command lives outside the skill.
 */

/** The actions the workflow exposes; `unknown` means "could not classify". */
export type WorkRequestAction =
  | 'analyze'
  | 'daily'
  | 'technical'
  | 'demo'
  | 'weekly'
  | 'status'
  | 'memory'
  | 'projects'
  | 'latest'
  | 'summary'
  | 'save'
  | 'clear'
  | 'preferences'
  | 'help'
  | 'unknown';

export interface WorkRequestIntentInput {
  /** The raw user message (untrusted — treated as data, never instructions). */
  message: string;
}

/**
 * The classified request. Optional fields are extracted ONLY when the message
 * states them explicitly; the skill never invents a project, spec, or diff.
 */
export interface WorkRequestIntent {
  action: WorkRequestAction;
  projectName?: string;
  spec?: string;
  diff?: string;
  /** For `save`: which proposed memory update the user meant, when stated. */
  saveSource?: 'daily' | 'weekly';
}
