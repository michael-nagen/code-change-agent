/**
 * Derive the compact Overview summary of a Daily Work Guidance artifact.
 *
 * This is a pure projection: it counts pending items and blockers and reads the
 * loop stage so the Overview panel can show status without parsing card HTML.
 * It performs no reasoning and never mutates the guidance.
 */
import type { DailyWorkGuidance } from '../../../../skills/dailyWorkGuidance/index.js';
import type { GuidanceOverview } from '../../../types.js';

export function summarizeGuidance(guidance: DailyWorkGuidance): GuidanceOverview {
  const pendingSteps = guidance.plannedSteps.filter((s) => s.status === 'pending_approval');
  const pendingDecisions = guidance.decisionsNeedingApproval.filter(
    (d) => d.status === 'pending_approval',
  );
  const firstPending = pendingSteps[0];
  return {
    loopStage: guidance.loopStatus.currentStage,
    overallStatus: guidance.loopStatus.overallStatus,
    pendingApprovals: pendingSteps.length + pendingDecisions.length,
    blockers: guidance.blockersAndRisks.length,
    ...(guidance.selfCritique !== undefined
      ? {
          selfCritique: {
            revisionApplied: guidance.selfCritique.revisionApplied,
            issues: guidance.selfCritique.issues.length,
          },
        }
      : {}),
    ...(firstPending !== undefined ? { todayPriority: firstPending.title } : {}),
  };
}
