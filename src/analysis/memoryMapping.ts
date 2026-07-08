/**
 * Analysis-layer bridge between a Daily Work Guidance artifact and the
 * storage-agnostic memory types.
 *
 * The memory module deliberately knows nothing about skills, so this mapping
 * lives here (the analysis layer already depends on skills). It is the single
 * place that decides how a run's proposed memory update becomes a durable
 * `ProjectProgressSnapshot`.
 */
import type { ApprovalStatus, DailyWorkGuidance } from '../skills/dailyWorkGuidance/index.js';
import type { WeeklyReview } from '../skills/weeklyReview/index.js';
import type { PlanDecisionRecord, ProjectProgressSnapshot } from '../memory/index.js';
import { decisionItemId } from './applyGuidanceDecisions.js';

/** Map an item's post-decision status back to the action that produced it. */
const ACTION_OF_STATUS: Partial<Record<ApprovalStatus, string>> = {
  approved: 'approve',
  rejected: 'reject',
  edited: 'edit',
  deferred: 'defer',
};

/**
 * The user's applied plan decisions, as durable records. Empty until decisions
 * have been applied (every item still pending yields no records).
 */
function planDecisionsFromGuidance(guidance: DailyWorkGuidance): PlanDecisionRecord[] {
  const records: PlanDecisionRecord[] = [];
  for (const step of guidance.plannedSteps ?? []) {
    const action = ACTION_OF_STATUS[step.status];
    if (action === undefined) continue;
    records.push({
      itemId: step.id,
      action,
      text: step.title,
      ...(step.note !== undefined ? { note: step.note } : {}),
    });
  }
  (guidance.decisionsNeedingApproval ?? []).forEach((entry, index) => {
    const action = ACTION_OF_STATUS[entry.status];
    if (action === undefined) return;
    records.push({
      itemId: decisionItemId(index),
      action,
      text: entry.decision,
      ...(entry.note !== undefined ? { note: entry.note } : {}),
    });
  });
  return records;
}

export function snapshotFromDailyWorkGuidance(guidance: DailyWorkGuidance): ProjectProgressSnapshot {
  const m = guidance.memoryUpdate;
  const planDecisions = planDecisionsFromGuidance(guidance);
  const loopStage = guidance.loopStatus?.currentStage;
  return {
    date: m.date,
    dailySummary: m.dailySummary,
    updatedChecklistStatuses: m.updatedChecklistStatuses.map((c) => ({
      item: c.item,
      status: c.status,
    })),
    openBlockers: [...m.openBlockers],
    // A run's "new decisions" are the decisions still open going forward.
    openDecisions: [...m.newDecisions],
    nextActions: [...m.nextActions],
    ...(loopStage !== undefined ? { loopStage } : {}),
    ...(planDecisions.length > 0 ? { planDecisions } : {}),
  };
}

/**
 * Map a Weekly Review's memory-update proposal into a durable snapshot. The
 * review's `generatedAt` date anchors the snapshot; its weekly summary, blockers,
 * decisions, and next actions carry forward as project memory.
 */
export function snapshotFromWeeklyReview(review: WeeklyReview): ProjectProgressSnapshot {
  const m = review.memoryUpdateProposal;
  return {
    date: review.status.generatedAt.slice(0, 10),
    dailySummary: m.latestWeeklySummary,
    updatedChecklistStatuses: m.updatedChecklistStatuses.map((c) => ({
      item: c.item,
      status: c.status,
    })),
    openBlockers: [...m.updatedBlockers],
    openDecisions: [...m.newDecisions],
    nextActions: [...m.nextActions],
  };
}
