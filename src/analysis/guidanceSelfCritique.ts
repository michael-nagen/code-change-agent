/**
 * The bounded self-critique pass over a freshly generated Daily Work Guidance
 * plan: critique once, revise at most once, then show the user.
 *
 * `runGuidanceSelfCritique` is the ONLY entry point and it calls the critic
 * skill exactly once — there is no retry and no loop, so the pass cannot
 * iterate. `applyGuidanceCritique` is the deterministic safety boundary that
 * decides what a revision may change:
 *  - only the planning sections (steps, open decisions, Notion update, memory
 *    update) are replaceable; the factual sections (yesterday summary,
 *    progress vs spec, advanced items, blockers, evidence) always come from
 *    the original guidance;
 *  - every revised step and decision enters as pending_approval with a fresh
 *    deterministic id — the critic cannot approve;
 *  - the loop status is untouched: the artifact remains an unreviewed
 *    proposal for the user;
 *  - the durable memory date never changes.
 * If the critic fails or returns invalid output, the original plan is kept
 * with a visible fallback note — generation never fails because of critique.
 */
import { HarnessError } from '../errors/HarnessError.js';
import { SkillError } from '../errors/SkillError.js';
import { logEvent, startTimer, describeErrorForLog } from '../observability/index.js';
import type {
  DailyWorkGuidance,
  GuidanceSelfCritique,
  PlannedStep,
} from '../skills/dailyWorkGuidance/index.js';
import type {
  GuidanceCritiqueSkill,
  GuidancePlanCritique,
} from '../skills/dailyWorkGuidanceCritique/index.js';
import type { RequirementAlignment } from '../skills/requirementAlignment/index.js';
import type { GapReport } from '../skills/gapReport/index.js';

export function applyGuidanceCritique({
  guidance,
  critique,
  checkedAt,
}: {
  /** The freshly generated guidance (pre-decision). */
  guidance: DailyWorkGuidance;
  critique: GuidancePlanCritique;
  /** ISO timestamp stamped onto the critique record. */
  checkedAt: string;
}): DailyWorkGuidance {
  // The critique reviews a fresh proposal only — applying it to a plan the
  // user already decided on would overwrite their decisions.
  if (!isPreDecision(guidance)) {
    throw new HarnessError(
      'VALIDATION',
      'A self-critique may only be applied to a plan with every item still pending approval.',
    );
  }
  // The critic may reframe open decisions but never remove approval points:
  // fewer decisions than before would silently take choices away from the user.
  if (
    critique.revisedPlan?.decisionsNeedingApproval !== undefined &&
    critique.revisedPlan.decisionsNeedingApproval.length < guidance.decisionsNeedingApproval.length
  ) {
    throw new HarnessError(
      'VALIDATION',
      `The critique tried to reduce the open decisions from ${guidance.decisionsNeedingApproval.length} to ${critique.revisedPlan.decisionsNeedingApproval.length} — revisions may reframe or add approval points, never remove them.`,
    );
  }

  const next = structuredClone(guidance) as DailyWorkGuidance;
  const revisionApplied = critique.revisionNeeded && critique.revisedPlan !== undefined;
  const selfCritique: GuidanceSelfCritique = {
    // A revision replaces the plan and re-ids its steps, so issue references
    // to the pre-revision steps would mislabel the new ones — drop them.
    issues: revisionApplied
      ? critique.issues.map(({ targetStepId: _dropped, ...issue }) => issue)
      : critique.issues,
    revisionApplied,
    summary: critique.summary,
    confidence: critique.confidence,
    checkedAt,
  };

  const revised = critique.revisedPlan;
  if (critique.revisionNeeded && revised !== undefined) {
    next.plannedSteps = revised.plannedSteps.map(
      (step, index): PlannedStep => ({
        // Ids are assigned here, never by the critic, so they stay unique and
        // the status stays pending regardless of what the model produced.
        id: `step-${index + 1}`,
        title: step.title,
        whyItMatters: step.whyItMatters,
        expectedOutput: step.expectedOutput,
        cursorPrompt: step.cursorPrompt,
        validationChecklist: [...step.validationChecklist],
        status: 'pending_approval',
        ...(step.relatedSpecItems !== undefined
          ? { relatedSpecItems: [...step.relatedSpecItems] }
          : {}),
      }),
    );
    if (revised.decisionsNeedingApproval !== undefined) {
      next.decisionsNeedingApproval = revised.decisionsNeedingApproval.map((decision) => ({
        decision: decision.decision,
        context: decision.context,
        status: 'pending_approval',
        ...(decision.options !== undefined ? { options: [...decision.options] } : {}),
        ...(decision.recommendedOption !== undefined
          ? { recommendedOption: decision.recommendedOption }
          : {}),
      }));
    }
    next.notionDailyUpdate = { ...revised.notionDailyUpdate };
    next.memoryUpdate = {
      ...revised.memoryUpdate,
      // The durable date never regresses, whatever the critic wrote.
      date: guidance.memoryUpdate.date,
    };
  }

  next.selfCritique = selfCritique;
  return next;
}

/**
 * Critique the generated plan once and apply at most one revision. Returns
 * the guidance to show the user; never throws.
 */
export async function runGuidanceSelfCritique({
  skill,
  guidance,
  requirementAlignment,
  gapReport,
  previousProgressMemory,
  todayGoal,
  checkedAt,
}: {
  skill: GuidanceCritiqueSkill;
  guidance: DailyWorkGuidance;
  requirementAlignment: RequirementAlignment;
  gapReport: GapReport;
  previousProgressMemory?: string;
  todayGoal?: string;
  /** ISO timestamp stamped onto the critique record. */
  checkedAt: string;
}): Promise<DailyWorkGuidance> {
  // The critique reviews a fresh proposal only. Anything already decided by
  // the user is out of its jurisdiction, so a decided plan passes through.
  if (!isPreDecision(guidance)) {
    return guidance;
  }

  logEvent({ event: 'self_critique_started', fields: { stepCount: guidance.plannedSteps.length } });
  const stopCritiqueTimer = startTimer();
  try {
    // Exactly one critic call per generation — no retry, no iteration.
    const critique = await skill.execute({
      guidance,
      requirementAlignment,
      gapReport,
      ...(previousProgressMemory !== undefined ? { previousProgressMemory } : {}),
      ...(todayGoal !== undefined ? { todayGoal } : {}),
    });
    const revised = applyGuidanceCritique({ guidance, critique, checkedAt });
    logEvent({
      event: 'self_critique_completed',
      fields: {
        durationMs: stopCritiqueTimer(),
        revisionApplied: revised.selfCritique?.revisionApplied ?? false,
        skipped: false,
      },
    });
    return revised;
  } catch (error) {
    // Invalid critic output or a failed model call must never cost the user
    // the plan: keep it, and say visibly that the critique was skipped. The
    // note stays generic — error messages can carry raw model output (e.g.
    // the parser quotes what it could not parse), which never belongs in the
    // product artifact.
    const reason =
      error instanceof SkillError || error instanceof HarnessError
        ? 'the critic returned invalid output'
        : 'the critique call failed';
    logEvent({
      event: 'self_critique_completed',
      level: 'warn',
      fields: { durationMs: stopCritiqueTimer(), revisionApplied: false, skipped: true, ...describeErrorForLog(error) },
    });
    const next = structuredClone(guidance) as DailyWorkGuidance;
    next.selfCritique = {
      issues: [],
      revisionApplied: false,
      summary: `Self-critique was skipped (${reason}). The original plan is shown unchanged.`,
      confidence: 'low',
      checkedAt,
    };
    return next;
  }
}

/** Whether every step and open decision still awaits the user's decision. */
function isPreDecision(guidance: DailyWorkGuidance): boolean {
  return (
    guidance.plannedSteps.every((step) => step.status === 'pending_approval') &&
    guidance.decisionsNeedingApproval.every((entry) => entry.status === 'pending_approval')
  );
}
