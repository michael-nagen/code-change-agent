/**
 * Types for the GuidanceRefinementSkill — model-in-the-loop re-planning for
 * the Daily Work Guidance approval loop.
 *
 * When the user REJECTS or EDITS planned steps (with notes explaining why),
 * this skill re-invokes the model with the decision-annotated guidance, the
 * decisions themselves, and prior project memory, and asks it to re-plan ONLY
 * the affected planning sections. It never re-runs the base code analysis and
 * never touches the factual sections (yesterday summary, progress vs spec,
 * blockers) — those stay exactly as generated.
 *
 * Safety: the model cannot approve anything. Every revised step comes back as
 * `pending_approval` (the parser rejects anything else), and the deterministic
 * merge in the analysis layer decides what the revision may replace.
 */
import type {
  DailyWorkGuidance,
  MemoryUpdate,
  NotionDailyUpdate,
} from '../dailyWorkGuidance/index.js';

/** One user decision, as fed back to the model (notes are untrusted text). */
export interface GuidanceRefinementDecision {
  itemId: string;
  action: 'approve' | 'reject' | 'edit' | 'defer';
  /** The user's replacement text when the action is "edit". */
  editedText?: string;
  /** The user's reason, when given — the core signal to re-plan from. */
  note?: string;
}

export interface GuidanceRefinementInput {
  /** The decision-annotated guidance (after the deterministic apply). */
  guidance: DailyWorkGuidance;
  /** The decision batch that triggered the refinement. */
  decisions: GuidanceRefinementDecision[];
  /** Prior project memory, when available. */
  previousProgressMemory?: string;
}

/**
 * A re-planned step. `respondsTo` ties it to the rejected/edited step it
 * replaces ("new" for a genuinely new step); the merge validates the target.
 */
export interface RevisedPlannedStep {
  respondsTo: string;
  title: string;
  whyItMatters: string;
  expectedOutput: string;
  cursorPrompt: string;
  validationChecklist: string[];
  relatedSpecItems?: string[];
  /** Always pending — the parser rejects any other value. */
  status: 'pending_approval';
}

/** The refinement output: only the planning sections, never the factual ones. */
export interface GuidancePlanRefinement {
  /** What was changed and why, grounded in the user's notes. */
  revisionSummary: string;
  revisedSteps: RevisedPlannedStep[];
  notionDailyUpdate: NotionDailyUpdate;
  memoryUpdate: MemoryUpdate;
}
