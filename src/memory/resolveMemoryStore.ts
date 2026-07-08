/**
 * Storage-agnostic factory for the MemoryStore.
 *
 * Callers ask for "a MemoryStore" and get one based on configuration — they
 * never name a concrete implementation. This is the single seam where the
 * durable backend is chosen, so migrating to Postgres/Mongo/Supabase/Redis/
 * Notion later means adding a case here, not touching the rest of the app.
 *
 * Env:
 *  - MEMORY_STORE     = 'file' (default) | 'memory' | 'db'
 *  - MEMORY_DATA_DIR  = data directory for the file store (default 'data/memory')
 *  - MEMORY_USER_ID   = the single-user id for MVP (default 'local')
 *  - DATABASE_URL     = Postgres connection string, read ONLY when MEMORY_STORE=db
 *
 * `DATABASE_URL` is required only in DB mode; any other mode ignores it, so the
 * default file/in-memory behavior is unchanged when it is unset.
 */
import { InMemoryMemoryStore } from './InMemoryMemoryStore.js';
import { JsonFileMemoryStore } from './JsonFileMemoryStore.js';
import { DbMemoryStore } from './DbMemoryStore.js';
import { createPgSqlClient } from './db/PgSqlClient.js';
import { MemoryStoreError } from '../errors/MemoryStoreError.js';
import type { MemoryStore } from './types/store.js';

export const DEFAULT_MEMORY_DATA_DIR = 'data/memory';
export const DEFAULT_USER_ID = 'local';

export type MemoryStoreKind = 'file' | 'memory' | 'db';

export function resolveMemoryStore(
  env: Record<string, string | undefined> = process.env,
): MemoryStore {
  const kind = resolveKind(env.MEMORY_STORE);

  if (kind === 'memory') {
    return new InMemoryMemoryStore();
  }

  if (kind === 'db') {
    const databaseUrl = env.DATABASE_URL?.trim();
    if (databaseUrl === undefined || databaseUrl === '') {
      throw new MemoryStoreError(
        'CONFIG',
        'MEMORY_STORE=db requires DATABASE_URL to be set (a Postgres connection string).',
      );
    }
    // The driver connects lazily on first use, so the resolver stays synchronous
    // and `pg` is only imported when DB memory is actually exercised.
    return new DbMemoryStore({ clientFactory: () => createPgSqlClient({ databaseUrl }) });
  }

  const dataDir = env.MEMORY_DATA_DIR ?? DEFAULT_MEMORY_DATA_DIR;
  return new JsonFileMemoryStore({ dataDir });
}

function resolveKind(value: string | undefined): MemoryStoreKind {
  if (value === 'memory') return 'memory';
  if (value === 'db') return 'db';
  return 'file';
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
