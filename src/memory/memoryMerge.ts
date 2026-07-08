/**
 * Memory merge logic (memory-side, skill-agnostic).
 *
 * These helpers assemble the read-only `DeveloperMemoryContext` handed to a run
 * and maintain the durable `ProjectMemory` record. They operate ONLY on memory
 * types, so they stay independent of any skill; the analysis layer is
 * responsible for mapping a specific artifact (e.g. Daily Work Guidance) into a
 * `ProjectProgressSnapshot`.
 *
 * Merge rules (see feature spec):
 *  - the current run's explicit input is the source of truth;
 *  - memory is supporting context only and never overrides current inputs;
 *  - uncertainty/absence is surfaced via `notes`, not silently assumed.
 */
import { MEMORY_SCHEMA_VERSION } from './types/memory.js';
import type {
  DeveloperMemoryContext,
  ProjectMemory,
  ProjectProgressSnapshot,
  UserPreferencesMemory,
} from './types/memory.js';

/** Keep project memory small; oldest snapshots beyond this are dropped. */
const DEFAULT_MAX_HISTORY = 30;

/** Render a snapshot into a plain-text "previous progress" block for a skill. */
export function renderPreviousProgressMemory(snapshot: ProjectProgressSnapshot): string {
  const lines: string[] = [`Previous progress (as of ${snapshot.date}):`, snapshot.dailySummary];

  if (snapshot.updatedChecklistStatuses.length > 0) {
    lines.push('Checklist status:');
    for (const c of snapshot.updatedChecklistStatuses) lines.push(`- ${c.item}: ${c.status}`);
  }
  if (snapshot.openBlockers.length > 0) {
    lines.push('Open blockers:');
    for (const b of snapshot.openBlockers) lines.push(`- ${b}`);
  }
  if (snapshot.openDecisions.length > 0) {
    lines.push('Open decisions:');
    for (const d of snapshot.openDecisions) lines.push(`- ${d}`);
  }
  if (snapshot.nextActions.length > 0) {
    lines.push('Planned next actions:');
    for (const n of snapshot.nextActions) lines.push(`- ${n}`);
  }
  if (snapshot.loopStage !== undefined) {
    lines.push(`Plan loop stage: ${snapshot.loopStage}`);
  }
  if (snapshot.planDecisions !== undefined && snapshot.planDecisions.length > 0) {
    lines.push('Plan decisions the developer already made:');
    for (const d of snapshot.planDecisions) {
      lines.push(`- [${d.action}] ${d.itemId}: ${d.text}${d.note !== undefined ? ` — ${d.note}` : ''}`);
    }
  }
  return lines.join('\n');
}

/**
 * Assemble the read-only context for a run from loaded user + project memory.
 * `previousProgressMemory` is derived only when a prior snapshot exists.
 */
export function buildDeveloperMemoryContext({
  userId,
  projectId,
  userMemory,
  projectMemory,
}: {
  userId: string;
  projectId?: string;
  userMemory?: UserPreferencesMemory;
  projectMemory?: ProjectMemory;
}): DeveloperMemoryContext {
  const notes: string[] = [];

  const latest = projectMemory?.latestSnapshot;
  const previousProgressMemory = latest !== undefined ? renderPreviousProgressMemory(latest) : undefined;

  if (projectId === undefined) {
    notes.push('No project id resolved — project memory not loaded.');
  } else if (projectMemory === undefined) {
    notes.push('No prior project memory found — treating this as the first tracked run.');
  } else if (latest === undefined) {
    notes.push('Project memory exists but has no saved progress snapshot yet.');
  }

  const context: DeveloperMemoryContext = {
    userId,
    notes,
    ...(projectId !== undefined ? { projectId } : {}),
    ...(userMemory !== undefined ? { userPreferences: userMemory } : {}),
    ...(projectMemory !== undefined ? { projectMemory } : {}),
    ...(previousProgressMemory !== undefined ? { previousProgressMemory } : {}),
  };
  return context;
}

/**
 * Produce an updated `ProjectMemory` with `snapshot` as the new latest, pushing
 * the prior latest into a bounded history. Pure: returns a new record.
 */
export function appendSnapshot({
  userId,
  projectId,
  snapshot,
  existing,
  maxHistory = DEFAULT_MAX_HISTORY,
  now = new Date().toISOString(),
}: {
  userId: string;
  projectId: string;
  snapshot: ProjectProgressSnapshot;
  existing?: ProjectMemory | undefined;
  maxHistory?: number;
  now?: string;
}): ProjectMemory {
  const priorHistory = existing?.history ?? [];
  const priorLatest = existing?.latestSnapshot;
  const history = priorLatest !== undefined ? [...priorHistory, priorLatest] : [...priorHistory];
  const bounded = history.slice(Math.max(0, history.length - maxHistory));

  return {
    schemaVersion: MEMORY_SCHEMA_VERSION,
    userId,
    projectId,
    latestSnapshot: snapshot,
    history: bounded,
    updatedAt: now,
  };
}
