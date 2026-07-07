/**
 * Storage-agnostic factory for the MemoryStore.
 *
 * Callers ask for "a MemoryStore" and get one based on configuration — they
 * never name a concrete implementation. This is the single seam where the
 * durable backend is chosen, so migrating to Postgres/Mongo/Supabase/Redis/
 * Notion later means adding a case here, not touching the rest of the app.
 *
 * Env:
 *  - MEMORY_STORE     = 'file' (default) | 'memory'
 *  - MEMORY_DATA_DIR  = data directory for the file store (default 'data/memory')
 *  - MEMORY_USER_ID   = the single-user id for MVP (default 'local')
 */
import { InMemoryMemoryStore } from './InMemoryMemoryStore.js';
import { JsonFileMemoryStore } from './JsonFileMemoryStore.js';
import type { MemoryStore } from './types/store.js';

export const DEFAULT_MEMORY_DATA_DIR = 'data/memory';
export const DEFAULT_USER_ID = 'local';

export type MemoryStoreKind = 'file' | 'memory';

export function resolveMemoryStore(
  env: Record<string, string | undefined> = process.env,
): MemoryStore {
  const kind: MemoryStoreKind = env.MEMORY_STORE === 'memory' ? 'memory' : 'file';
  if (kind === 'memory') {
    return new InMemoryMemoryStore();
  }
  const dataDir = env.MEMORY_DATA_DIR ?? DEFAULT_MEMORY_DATA_DIR;
  return new JsonFileMemoryStore({ dataDir });
}

/** The MVP single-user id, from env or the safe default. */
export function resolveUserId(env: Record<string, string | undefined> = process.env): string {
  const fromEnv = env.MEMORY_USER_ID?.trim();
  return fromEnv !== undefined && fromEnv !== '' ? toMemoryId(fromEnv) : DEFAULT_USER_ID;
}

/**
 * Turn an arbitrary human label (e.g. a project name) into a filesystem/DB-safe
 * id: lowercased, non-alphanumerics collapsed to '-', trimmed. Returns undefined
 * when nothing usable remains, so callers can skip project memory entirely.
 */
export function toMemoryId(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 100);
}

export function toMemoryProjectId(label: string): string | undefined {
  const id = toMemoryId(label);
  return id === '' ? undefined : id;
}
