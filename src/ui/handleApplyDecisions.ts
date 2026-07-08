/**
 * The apply-decisions handler: the user-action half of the guidance approval
 * loop.
 *
 * Approve/defer-only batches are applied purely deterministically (no LLM).
 * When the batch contains a reject or an edit, the model re-plans the affected
 * planning sections through the refinement skill, and the deterministic merge
 * bounds what that revision may change; revised steps return as pending
 * approval. If the model's output fails validation, the safe deterministic
 * result is kept and the failure is reported — user decisions are never lost.
 * The updated artifact is stored back on the session, and — when a project
 * name is set — persisted as a project memory snapshot so the next run for the
 * same project reloads it as previous progress. It never throws: every failure
 * is returned as a structured error whose message is shown verbatim.
 */
import type { MemoryStore } from '../memory/index.js';
import {
  appendSnapshot,
  renderPreviousProgressMemory,
  resolveUserId,
  toMemoryProjectId,
} from '../memory/index.js';
import {
  applyGuidanceDecisions,
  type GuidanceDecision,
  type GuidanceDecisionAction,
} from '../analysis/applyGuidanceDecisions.js';
import { mergeGuidanceRefinement } from '../analysis/mergeGuidanceRefinement.js';
import { snapshotFromDailyWorkGuidance } from '../analysis/memoryMapping.js';
import { HarnessError } from '../errors/HarnessError.js';
import {
  logEvent,
  runWithTrace,
  newTraceId,
  startTimer,
  describeErrorForLog,
} from '../observability/index.js';
import type { AnalysisResult } from '../analysis/index.js';
import type { DailyWorkGuidance } from '../skills/dailyWorkGuidance/index.js';
import type { GuidanceRefinementSkill } from '../skills/dailyWorkGuidanceRefinement/index.js';
import { renderWorkspaceCards, summarizeGuidance } from './features/artifactViews/index.js';
import { buildMemoryStatus } from './memoryStatus.js';
import type { ApplyDecisionsResponse, MemoryStatus, WorkspaceCard } from './types.js';
import type { UiSessionStore } from './sessionStore.js';

const VALID_ACTIONS: readonly GuidanceDecisionAction[] = ['approve', 'reject', 'edit', 'defer'];

/** Parse the untrusted decision list, or return a user-facing error message. */
function parseDecisions(raw: unknown): { decisions: GuidanceDecision[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: 'Choose at least one decision before applying.' };
  }
  const decisions: GuidanceDecision[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) {
      return { error: 'Every decision must be an object.' };
    }
    const fields = entry as Record<string, unknown>;
    const itemId = typeof fields.itemId === 'string' ? fields.itemId.trim() : '';
    const action = typeof fields.action === 'string' ? fields.action : '';
    if (itemId === '') {
      return { error: 'Every decision needs an itemId.' };
    }
    if (!(VALID_ACTIONS as readonly string[]).includes(action)) {
      return { error: `Invalid action for "${itemId}". Use approve, reject, edit, or defer.` };
    }
    const editedText = typeof fields.editedText === 'string' ? fields.editedText.trim() : '';
    const note = typeof fields.note === 'string' ? fields.note.trim() : '';
    decisions.push({
      itemId,
      action: action as GuidanceDecisionAction,
      ...(editedText !== '' ? { editedText } : {}),
      ...(note !== '' ? { note } : {}),
    });
  }
  return { decisions };
}

interface ApplyDecisionsArgs {
  memoryStore: MemoryStore;
  store: UiSessionStore;
  sessionId: string;
  body: unknown;
  /** Re-plans after reject/edit feedback; without it only the deterministic path runs. */
  refinementSkill?: GuidanceRefinementSkill;
}

/**
 * Public entry point. Establishes a per-action trace (correlating any model
 * re-planning and the memory save that follow) and delegates to the handler.
 */
export async function handleApplyDecisions(
  args: ApplyDecisionsArgs,
): Promise<ApplyDecisionsResponse> {
  return runWithTrace(
    { traceId: newTraceId(), sessionId: args.sessionId },
    () => applyDecisions(args),
  );
}

async function applyDecisions({
  memoryStore,
  store,
  sessionId,
  body,
  refinementSkill,
}: ApplyDecisionsArgs): Promise<ApplyDecisionsResponse> {
  if (typeof body !== 'object' || body === null) {
    return { status: 'error', message: 'Request body must be a JSON object.' };
  }
  const fields = body as Record<string, unknown>;
  const parsed = parseDecisions(fields.decisions);
  if ('error' in parsed) {
    return { status: 'error', message: parsed.error };
  }
  const projectName = typeof fields.projectName === 'string' ? fields.projectName : '';

  const result = store.getResult(sessionId);
  if (result === undefined) {
    return { status: 'error', message: `Session not found: ${sessionId}` };
  }
  if (result.dailyWorkGuidance === undefined) {
    return {
      status: 'error',
      message: 'Generate Daily Work Guidance first — there is no plan to decide on.',
    };
  }

  const decidedAt = new Date().toISOString();
  let updated;
  try {
    updated = applyGuidanceDecisions({
      guidance: result.dailyWorkGuidance,
      decisions: parsed.decisions,
      decidedAt,
    });
  } catch (error) {
    const message =
      error instanceof HarnessError ? error.message : error instanceof Error ? error.message : String(error);
    return { status: 'error', message };
  }

  // Reject/edit feedback triggers model re-planning; approve/defer-only
  // batches stay on the deterministic path.
  const refined = await refinePlanIfNeeded({
    decided: updated.guidance,
    decisions: parsed.decisions,
    decidedAt,
    memoryStore,
    projectName,
    ...(refinementSkill !== undefined ? { refinementSkill } : {}),
  });

  const updatedResult = store.updateDailyWorkGuidance({ sessionId, guidance: refined.guidance });

  // Persist the decided plan so the next run for this project reloads it.
  // Without a project name there is no memory key; the decision still applies
  // to the session, and the message says memory was not saved.
  const persisted = await persistDecidedPlan({ memoryStore, projectName, updated: refined.guidance });
  if ('error' in persisted) {
    return { status: 'error', message: persisted.error };
  }

  const { currentStage, overallStatus } = refined.guidance.loopStatus;
  const suffix =
    persisted.memory !== undefined
      ? ` Saved to project memory for the next run.`
      : ' Set a project name to persist this into memory for the next run.';
  return {
    status: 'success',
    message: `Applied ${updated.applied} decision${updated.applied === 1 ? '' : 's'}${refined.note} — loop is now ${currentStage} (${overallStatus}).${suffix}`,
    card: findGuidanceCard(updatedResult),
    loopStatus: { currentStage, overallStatus },
    guidance: summarizeGuidance(refined.guidance),
    ...(refined.revisionSummary !== undefined ? { revisionSummary: refined.revisionSummary } : {}),
    ...(persisted.memory !== undefined ? { memory: persisted.memory } : {}),
  };
}

/**
 * Run the model re-plan when the batch contains reject/edit feedback and a
 * refinement skill is wired. Invalid or failing model output keeps the safe
 * deterministic result (the model output is discarded, never partially used)
 * and reports the failure in the message.
 */
async function refinePlanIfNeeded({
  decided,
  decisions,
  decidedAt,
  memoryStore,
  projectName,
  refinementSkill,
}: {
  decided: DailyWorkGuidance;
  decisions: GuidanceDecision[];
  decidedAt: string;
  memoryStore: MemoryStore;
  projectName: string;
  refinementSkill?: GuidanceRefinementSkill;
}): Promise<{ guidance: DailyWorkGuidance; note: string; revisionSummary?: string }> {
  const needsRefinement = decisions.some(
    (decision) => decision.action === 'reject' || decision.action === 'edit',
  );
  if (!needsRefinement || refinementSkill === undefined) {
    return { guidance: decided, note: '' };
  }

  const previousProgressMemory = await loadPreviousProgressMemory({ memoryStore, projectName });
  logEvent({
    event: 'refinement_started',
    fields: {
      feedbackDecisions: decisions.filter((d) => d.action === 'reject' || d.action === 'edit').length,
    },
  });
  const stopRefinementTimer = startTimer();
  try {
    const refinement = await refinementSkill.execute({
      guidance: decided,
      decisions,
      ...(previousProgressMemory !== undefined ? { previousProgressMemory } : {}),
    });
    const guidance = mergeGuidanceRefinement({ decided, refinement, decidedAt });
    logEvent({
      event: 'refinement_completed',
      fields: {
        durationMs: stopRefinementTimer(),
        revisedSteps: refinement.revisedSteps.length,
        replanned: true,
      },
    });
    return {
      guidance,
      note: ` and re-planned ${refinement.revisedSteps.length} step${refinement.revisedSteps.length === 1 ? '' : 's'} from your feedback`,
      revisionSummary: refinement.revisionSummary,
    };
  } catch (error) {
    logEvent({
      event: 'refinement_completed',
      level: 'warn',
      fields: { durationMs: stopRefinementTimer(), replanned: false, ...describeErrorForLog(error) },
    });
    const message = error instanceof Error ? error.message : String(error);
    return { guidance: decided, note: ` (plan refinement failed and was skipped: ${message})` };
  }
}

/** Prior project memory as re-plan context; absent memory is fine (fails open). */
async function loadPreviousProgressMemory({
  memoryStore,
  projectName,
}: {
  memoryStore: MemoryStore;
  projectName: string;
}): Promise<string | undefined> {
  const projectId = toMemoryProjectId(projectName);
  if (projectId === undefined) return undefined;
  try {
    const memory = await memoryStore.getProjectMemory({ userId: resolveUserId(), projectId });
    const latest = memory?.latestSnapshot;
    return latest !== undefined ? renderPreviousProgressMemory(latest) : undefined;
  } catch {
    return undefined;
  }
}

async function persistDecidedPlan({
  memoryStore,
  projectName,
  updated,
}: {
  memoryStore: MemoryStore;
  projectName: string;
  updated: DailyWorkGuidance;
}): Promise<{ memory?: MemoryStatus } | { error: string }> {
  const projectId = toMemoryProjectId(projectName);
  if (projectId === undefined) {
    return {};
  }
  try {
    const userId = resolveUserId();
    const snapshot = snapshotFromDailyWorkGuidance(updated);
    const existing = await memoryStore.getProjectMemory({ userId, projectId });
    const memory = appendSnapshot({
      userId,
      projectId,
      snapshot,
      ...(existing !== undefined ? { existing } : {}),
    });
    await memoryStore.saveProjectMemory({ userId, projectId, memory });
    logEvent({
      event: 'memory_saved',
      fields: {
        scope: 'project',
        projectId,
        source: 'applyDecisions',
        snapshotDate: snapshot.date,
        snapshotHistoryCount: memory.history.length,
      },
    });
    const status = await buildMemoryStatus({ memoryStore, projectName, markLoaded: false });
    return { memory: status };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: `Decisions were applied, but saving memory failed: ${message}` };
  }
}

function findGuidanceCard(result: AnalysisResult): WorkspaceCard {
  const card = renderWorkspaceCards(result).find((c) => c.id === 'dailyWorkGuidance');
  if (card === undefined) {
    throw new Error('No card rendered for artifact "dailyWorkGuidance".');
  }
  return card;
}
