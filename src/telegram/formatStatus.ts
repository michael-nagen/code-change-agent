/**
 * Format project memory into concise, readable Telegram messages. Pure — it does
 * no I/O and reads only the storage-agnostic memory types, so it stays decoupled
 * from the UI's own `MemoryStatus` shape.
 */
import type { ProjectMemory } from '../memory/types/memory.js';

const CHECK = '✅';
const WARN = '⚠️';
const DOT = '•';

/** A full status view: latest summary, checklist, blockers, next actions. */
export function formatProjectStatus({
  projectLabel,
  memory,
}: {
  projectLabel: string;
  memory: ProjectMemory | undefined;
}): string {
  const header = `Project: ${projectLabel}`;
  const snapshot = memory?.latestSnapshot;
  if (memory === undefined || snapshot === undefined) {
    return `${header}\n\nNo saved progress yet. Run an analysis and save memory in the app first.`;
  }

  const lines: string[] = [header];
  if (memory.activeSpecSummary !== undefined && memory.activeSpecSummary.trim() !== '') {
    lines.push('', `Spec: ${memory.activeSpecSummary}`);
  }

  lines.push('', `Latest (${snapshot.date}):`, snapshot.dailySummary);

  if (snapshot.updatedChecklistStatuses.length > 0) {
    lines.push('', 'Progress:');
    for (const c of snapshot.updatedChecklistStatuses) {
      lines.push(`${statusIcon(c.status)} ${c.item} — ${c.status}`);
    }
  }

  if (snapshot.openBlockers.length > 0) {
    lines.push('', 'Blockers:');
    for (const b of snapshot.openBlockers) lines.push(`- ${b}`);
  }

  if (snapshot.nextActions.length > 0) {
    lines.push('', 'Next:');
    snapshot.nextActions.forEach((n, i) => lines.push(`${i + 1}. ${n}`));
  }

  return lines.join('\n');
}

/** A compact snapshot: summary plus counts, for the `/memory` command. */
export function formatMemorySnapshot({
  projectLabel,
  memory,
}: {
  projectLabel: string;
  memory: ProjectMemory | undefined;
}): string {
  const snapshot = memory?.latestSnapshot;
  if (memory === undefined || snapshot === undefined) {
    return `Project: ${projectLabel}\n\nNo saved memory yet.`;
  }
  const doneCount = snapshot.updatedChecklistStatuses.filter((c) => isDone(c.status)).length;
  return [
    `Project: ${projectLabel}`,
    `Updated: ${memory.updatedAt}`,
    '',
    snapshot.dailySummary,
    '',
    `${DOT} Checklist: ${doneCount}/${snapshot.updatedChecklistStatuses.length} done`,
    `${DOT} Open blockers: ${snapshot.openBlockers.length}`,
    `${DOT} Next actions: ${snapshot.nextActions.length}`,
  ].join('\n');
}

/** The list of saved projects, with the active one flagged. */
export function formatProjectsList({
  projectIds,
  activeLabel,
}: {
  projectIds: string[];
  activeLabel: string | undefined;
}): string {
  if (projectIds.length === 0) {
    return 'No saved projects yet. Run /analyze then /daily and /save to create project memory.';
  }
  const activeId = activeLabel !== undefined ? activeLabel.trim().toLowerCase() : undefined;
  const lines = ['Saved projects:', ''];
  for (const id of projectIds) {
    const isActive = activeId !== undefined && id.toLowerCase() === activeId;
    lines.push(`${isActive ? '➡️' : DOT} ${id}${isActive ? ' (active)' : ''}`);
  }
  lines.push('', 'Tap a project below, or send "/status <name>".');
  return lines.join('\n');
}

/** A short, high-level summary of a project's current state. */
export function formatProjectSummary({
  projectLabel,
  memory,
}: {
  projectLabel: string;
  memory: ProjectMemory | undefined;
}): string {
  const snapshot = memory?.latestSnapshot;
  if (memory === undefined || snapshot === undefined) {
    return `${projectLabel}: no saved progress yet. Run /analyze then /daily to start.`;
  }
  const doneCount = snapshot.updatedChecklistStatuses.filter((c) => isDone(c.status)).length;
  const total = snapshot.updatedChecklistStatuses.length;
  const lines = [
    `${projectLabel} — summary`,
    '',
    snapshot.dailySummary,
    '',
    `Progress: ${doneCount}/${total} checklist items done`,
    `Blockers: ${snapshot.openBlockers.length} · Next actions: ${snapshot.nextActions.length}`,
  ];
  const firstNext = snapshot.nextActions[0];
  if (firstNext !== undefined) lines.push('', `Next: ${firstNext}`);
  return lines.join('\n');
}

function statusIcon(status: string): string {
  return isDone(status) ? CHECK : WARN;
}

function isDone(status: string): boolean {
  return /done|complete|✅/i.test(status);
}
