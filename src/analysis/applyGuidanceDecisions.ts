/**
 * Applies the user's approve / reject / edit / defer decisions to a Daily Work
 * Guidance artifact — the state-transition half of the approval loop.
 *
 * Deterministic and pure: no LLM, no re-analysis. Decisions flip item
 * statuses, edited text replaces the item's text, and the dependent sections
 * (Notion daily update, memory update, loop status) are recomputed from the
 * resulting state so the artifact stays internally consistent. The loop stage
 * advances to `approved_plan` only when nothing remains pending — deferred
 * items are conscious choices and do not block the advance.
 */
import { HarnessError } from '../errors/HarnessError.js';
import type {
  ApprovalStatus,
  DailyWorkGuidance,
  DecisionNeedingApproval,
  PlannedStep,
} from '../skills/dailyWorkGuidance/index.js';

export type GuidanceDecisionAction = 'approve' | 'reject' | 'edit' | 'defer';

const VALID_ACTIONS: readonly GuidanceDecisionAction[] = ['approve', 'reject', 'edit', 'defer'];

/**
 * One user decision. `itemId` is a planned step's own id (e.g. "step-1") or
 * `decision-<n>` for the n-th (1-based) entry of decisionsNeedingApproval.
 */
export interface GuidanceDecision {
  itemId: string;
  action: GuidanceDecisionAction;
  /** Replacement text; required when action is "edit". */
  editedText?: string;
  /** Optional reason recorded on the item and in the memory update. */
  note?: string;
}

export interface ApplyGuidanceDecisionsResult {
  guidance: DailyWorkGuidance;
  /** How many decisions were applied. */
  applied: number;
}

const STATUS_OF_ACTION: Record<GuidanceDecisionAction, ApprovalStatus> = {
  approve: 'approved',
  reject: 'rejected',
  edit: 'edited',
  defer: 'deferred',
};

/** The 1-based id used to address decisionsNeedingApproval entries. */
export function decisionItemId(index: number): string {
  return `decision-${index + 1}`;
}

export function applyGuidanceDecisions({
  guidance,
  decisions,
  decidedAt,
}: {
  guidance: DailyWorkGuidance;
  decisions: readonly GuidanceDecision[];
  /** ISO timestamp stamped onto the loop status. */
  decidedAt: string;
}): ApplyGuidanceDecisionsResult {
  if (decisions.length === 0) {
    throw new HarnessError('VALIDATION', 'At least one decision is required.');
  }
  for (const decision of decisions) {
    assertValidDecision(decision);
  }

  const next = structuredClone(guidance) as DailyWorkGuidance;
  const stepById = new Map(next.plannedSteps.map((step) => [step.id, step]));
  const decisionById = new Map(
    next.decisionsNeedingApproval.map((entry, index) => [decisionItemId(index), entry]),
  );

  for (const decision of decisions) {
    const step = stepById.get(decision.itemId);
    if (step !== undefined) {
      applyToStep({ step, decision });
      continue;
    }
    const open = decisionById.get(decision.itemId);
    if (open !== undefined) {
      applyToDecision({ entry: open, decision });
      continue;
    }
    throw new HarnessError(
      'VALIDATION',
      `Unknown item id "${decision.itemId}" — it matches no planned step or open decision.`,
    );
  }

  recomputeDependentSections(next);
  advanceLoopStatus({ guidance: next, decidedAt });

  return { guidance: next, applied: decisions.length };
}

function assertValidDecision(decision: GuidanceDecision): void {
  if (typeof decision.itemId !== 'string' || decision.itemId.trim() === '') {
    throw new HarnessError('VALIDATION', 'Every decision needs a non-empty itemId.');
  }
  if (!VALID_ACTIONS.includes(decision.action)) {
    throw new HarnessError(
      'VALIDATION',
      `Invalid action "${String(decision.action)}" for "${decision.itemId}". Use one of: ${VALID_ACTIONS.join(', ')}.`,
    );
  }
  if (decision.action === 'edit' && (decision.editedText === undefined || decision.editedText.trim() === '')) {
    throw new HarnessError(
      'VALIDATION',
      `Editing "${decision.itemId}" requires non-empty editedText.`,
    );
  }
}

function applyToStep({ step, decision }: { step: PlannedStep; decision: GuidanceDecision }): void {
  step.status = STATUS_OF_ACTION[decision.action];
  if (decision.action === 'edit' && decision.editedText !== undefined) {
    step.title = decision.editedText.trim();
  }
  if (decision.note !== undefined && decision.note.trim() !== '') {
    step.note = decision.note.trim();
  }
}

function applyToDecision({
  entry,
  decision,
}: {
  entry: DecisionNeedingApproval;
  decision: GuidanceDecision;
}): void {
  entry.status = STATUS_OF_ACTION[decision.action];
  if (decision.action === 'edit' && decision.editedText !== undefined) {
    entry.decision = decision.editedText.trim();
  }
  if (decision.note !== undefined && decision.note.trim() !== '') {
    entry.note = decision.note.trim();
  }
}

/** Steps the user has accepted into the active plan (approved or edited). */
function activeSteps(guidance: DailyWorkGuidance): PlannedStep[] {
  return guidance.plannedSteps.filter(
    (step) => step.status === 'approved' || step.status === 'edited',
  );
}

/**
 * Recompute the fields that are pure functions of item statuses (today's
 * approved plan, open decisions, next prompt, next actions). Shared with the
 * refinement merge so the model can regenerate prose while these facts always
 * come from the actual statuses, never from model claims.
 */
export function recomputeStatusDerivedSections(guidance: DailyWorkGuidance): void {
  const active = activeSteps(guidance);
  const pendingDecisions = guidance.decisionsNeedingApproval.filter(
    (entry) => entry.status === 'pending_approval',
  );

  guidance.notionDailyUpdate.today =
    active.length > 0
      ? `Approved plan: ${active.map((step) => step.title).join('; ')}`
      : 'No steps approved yet.';
  guidance.notionDailyUpdate.decisionsNeeded =
    pendingDecisions.length > 0
      ? pendingDecisions.map((entry) => entry.decision).join('; ')
      : 'None — all surfaced decisions are resolved.';
  const firstActive = active[0];
  if (firstActive !== undefined) {
    guidance.notionDailyUpdate.nextCursorPrompt = firstActive.cursorPrompt;
  }

  guidance.memoryUpdate.nextActions = active.map((step) => step.title);
}

/**
 * Recompute the sections that summarize the plan so they reflect the user's
 * decisions rather than the original proposal.
 */
function recomputeDependentSections(guidance: DailyWorkGuidance): void {
  recomputeStatusDerivedSections(guidance);
  // Append only lines not already recorded, so multi-round loops (decide →
  // revise → decide again) never duplicate the audit trail.
  const seen = new Set(guidance.memoryUpdate.newDecisions);
  guidance.memoryUpdate.newDecisions = [
    ...guidance.memoryUpdate.newDecisions,
    ...decisionLines(guidance).filter((line) => !seen.has(line)),
  ];
}

/** One durable line per decided item, carried into memory. */
function decisionLines(guidance: DailyWorkGuidance): string[] {
  const lines: string[] = [];
  const describe = (status: ApprovalStatus, text: string, note?: string): string | undefined => {
    if (status === 'pending_approval') return undefined;
    const label =
      status === 'approved'
        ? 'Approved'
        : status === 'rejected'
          ? 'Rejected'
          : status === 'edited'
            ? 'Edited'
            : 'Deferred';
    return `${label}: ${text}${note !== undefined ? ` — ${note}` : ''}`;
  };
  for (const step of guidance.plannedSteps) {
    const line = describe(step.status, `${step.id}: ${step.title}`, step.note);
    if (line !== undefined) lines.push(line);
  }
  guidance.decisionsNeedingApproval.forEach((entry, index) => {
    const line = describe(entry.status, `${decisionItemId(index)}: ${entry.decision}`, entry.note);
    if (line !== undefined) lines.push(line);
  });
  return lines;
}

/** Whether any planned step or open decision still awaits the user. */
export function hasPendingItems(guidance: DailyWorkGuidance): boolean {
  return (
    guidance.plannedSteps.some((step) => step.status === 'pending_approval') ||
    guidance.decisionsNeedingApproval.some((entry) => entry.status === 'pending_approval')
  );
}

/**
 * Stage advances only when no item still awaits the user: every planned step
 * and open decision has been approved, rejected, edited, or deferred. A plan
 * that was already model-revised stays at the revised stage (not back to
 * planning) while its remaining items are decided; the revision summary is
 * carried along so the loop history stays visible.
 */
function advanceLoopStatus({
  guidance,
  decidedAt,
}: {
  guidance: DailyWorkGuidance;
  decidedAt: string;
}): void {
  const lastRevisionSummary = guidance.loopStatus.lastRevisionSummary;
  const pendingStage =
    guidance.loopStatus.currentStage === 'revised_plan_pending_approval'
      ? 'revised_plan_pending_approval'
      : 'planning';

  guidance.loopStatus = hasPendingItems(guidance)
    ? { currentStage: pendingStage, overallStatus: 'pending_user_review', decidedAt }
    : { currentStage: 'approved_plan', overallStatus: 'approved', decidedAt };
  if (lastRevisionSummary !== undefined) {
    guidance.loopStatus.lastRevisionSummary = lastRevisionSummary;
  }
}
