/**
 * Deterministic merge of a model re-plan into decision-annotated guidance —
 * the safety boundary of the model-in-the-loop refinement.
 *
 * The model only proposes; this merge decides what a proposal may touch:
 *  - a revision may respond only to a step the user REJECTED or EDITED in
 *    this artifact (or introduce a "new" step) — anything else fails closed;
 *  - approved / deferred / pending originals are preserved verbatim;
 *  - rejected originals stay visible as rejected history; edited originals
 *    are superseded in place by their revision (the user's edit asked for a
 *    re-plan, and the revision returns for their approval);
 *  - every revised step enters as pending_approval with a deterministic
 *    fresh id — the model cannot approve, rename, or collide ids;
 *  - factual sections (yesterday summary, progress vs spec, advanced items,
 *    blockers) are taken from the decided guidance, never from the model;
 *  - the model's Notion/memory prose is accepted, but every status-derived
 *    field (today's approved plan, decisions needed, next actions, next
 *    prompt) is recomputed from the real post-merge statuses.
 */
import { HarnessError } from '../errors/HarnessError.js';
import type { DailyWorkGuidance, PlannedStep } from '../skills/dailyWorkGuidance/index.js';
import type { GuidancePlanRefinement } from '../skills/dailyWorkGuidanceRefinement/index.js';
import { recomputeStatusDerivedSections, hasPendingItems } from './applyGuidanceDecisions.js';

/** The respondsTo value that introduces a step not replacing any existing one. */
const NEW_STEP_TARGET = 'new';

export function mergeGuidanceRefinement({
  decided,
  refinement,
  decidedAt,
}: {
  /** The guidance after the deterministic decision apply. */
  decided: DailyWorkGuidance;
  refinement: GuidancePlanRefinement;
  /** ISO timestamp stamped onto the loop status. */
  decidedAt: string;
}): DailyWorkGuidance {
  const next = structuredClone(decided) as DailyWorkGuidance;

  const revisableIds = new Set(
    next.plannedSteps
      .filter((step) => step.status === 'rejected' || step.status === 'edited')
      .map((step) => step.id),
  );
  for (const revised of refinement.revisedSteps) {
    if (revised.respondsTo !== NEW_STEP_TARGET && !revisableIds.has(revised.respondsTo)) {
      throw new HarnessError(
        'VALIDATION',
        `Refinement responds to "${revised.respondsTo}", which is not a rejected or edited step — revisions may only replace items the user pushed back on.`,
      );
    }
  }

  const usedIds = new Set(next.plannedSteps.map((step) => step.id));
  const revisedByTarget = new Map(
    refinement.revisedSteps.map((revised) => [revised.respondsTo, revised]),
  );
  const toPlannedStep = (revised: GuidancePlanRefinement['revisedSteps'][number]): PlannedStep => ({
    id: nextRevisedId(usedIds),
    title: revised.title,
    whyItMatters: revised.whyItMatters,
    expectedOutput: revised.expectedOutput,
    cursorPrompt: revised.cursorPrompt,
    validationChecklist: [...revised.validationChecklist],
    status: 'pending_approval',
    respondsTo: revised.respondsTo,
    ...(revised.relatedSpecItems !== undefined
      ? { relatedSpecItems: [...revised.relatedSpecItems] }
      : {}),
  });

  const merged: PlannedStep[] = [];
  for (const step of next.plannedSteps) {
    const revision = step.status === 'edited' ? revisedByTarget.get(step.id) : undefined;
    if (revision !== undefined) {
      // The user's edit asked for a re-plan; the revision supersedes it in
      // place and returns for their approval.
      merged.push(toPlannedStep(revision));
      revisedByTarget.delete(step.id);
      continue;
    }
    merged.push(step);
  }
  // Revisions of rejected steps and brand-new steps append after the plan;
  // the rejected originals above stay visible as history.
  for (const revised of refinement.revisedSteps) {
    if (revisedByTarget.get(revised.respondsTo) === revised) {
      merged.push(toPlannedStep(revised));
    }
  }
  next.plannedSteps = merged;

  // Model prose is accepted for the regenerated sections...
  next.notionDailyUpdate = { ...refinement.notionDailyUpdate };
  next.memoryUpdate = {
    ...refinement.memoryUpdate,
    // ...but the durable date and decision history never regress.
    date: decided.memoryUpdate.date,
    newDecisions: mergeDecisionLines({
      decided: decided.memoryUpdate.newDecisions,
      proposed: refinement.memoryUpdate.newDecisions,
    }),
  };
  // ...and every status-derived fact comes from the real statuses.
  recomputeStatusDerivedSections(next);

  next.loopStatus = hasPendingItems(next)
    ? {
        currentStage: 'revised_plan_pending_approval',
        overallStatus: 'pending_user_review',
        decidedAt,
        lastRevisionSummary: refinement.revisionSummary,
      }
    : {
        currentStage: 'approved_plan',
        overallStatus: 'approved',
        decidedAt,
        lastRevisionSummary: refinement.revisionSummary,
      };

  return next;
}

/** Fresh, collision-free ids for revised steps: step-r1, step-r2, … */
function nextRevisedId(usedIds: Set<string>): string {
  let n = 1;
  while (usedIds.has(`step-r${n}`)) {
    n += 1;
  }
  const id = `step-r${n}`;
  usedIds.add(id);
  return id;
}

/**
 * Keep every decision line the deterministic apply recorded (the durable
 * audit trail) and append the model's new lines that are not already present.
 */
function mergeDecisionLines({
  decided,
  proposed,
}: {
  decided: string[];
  proposed: string[];
}): string[] {
  const seen = new Set(decided);
  return [...decided, ...proposed.filter((line) => !seen.has(line))];
}
