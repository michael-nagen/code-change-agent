/**
 * Analysis-layer bridge between a Daily Work Guidance artifact and the
 * storage-agnostic memory types.
 *
 * The memory module deliberately knows nothing about skills, so this mapping
 * lives here (the analysis layer already depends on skills). It is the single
 * place that decides how a run's proposed memory update becomes a durable
 * `ProjectProgressSnapshot`.
 */
import type { DailyWorkGuidance } from '../skills/dailyWorkGuidance/index.js';
import type { WeeklyReview } from '../skills/weeklyReview/index.js';
import type { ProjectProgressSnapshot } from '../memory/index.js';

export function snapshotFromDailyWorkGuidance(guidance: DailyWorkGuidance): ProjectProgressSnapshot {
  const m = guidance.memoryUpdate;
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
