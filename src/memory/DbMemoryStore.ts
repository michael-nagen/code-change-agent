/**
 * External DB-backed MemoryStore — the production/serverless durable option.
 *
 * Unlike `JsonFileMemoryStore` (great locally, but backed by an ephemeral or
 * read-only filesystem on many hosts), this store persists memory in an external
 * SQL database so it survives deploys, restarts, and serverless cold starts.
 *
 * Storage shape (JSON-document style — see docs/integrations-setup.md):
 *   user_memory(user_id PK, memory_json jsonb, updated_at)
 *   project_memory(user_id, project_id, memory_json jsonb, updated_at, PK(user_id, project_id))
 *
 * The whole `UserPreferencesMemory` / `ProjectMemory` record is stored as one
 * JSONB document. That keeps the schema tiny and lets the memory model evolve
 * (new fields, snapshots, checklist statuses, decisions, blockers, next actions)
 * without migrations — the same reason the file store serializes to JSON.
 *
 * It talks only to the injected `SqlClient` port, so the concrete driver (`pg`)
 * and a test double are interchangeable. Records are validated on read and write
 * exactly like the other stores, so a corrupted row fails closed rather than
 * flowing bad data into the app. No connection string or secret is ever logged.
 */
import { MemoryStoreError } from '../errors/MemoryStoreError.js';
import type { SqlClient, SqlClientFactory } from './db/SqlClient.js';
import type {
  ClearProjectMemoryInput,
  GetProjectMemoryInput,
  GetUserMemoryInput,
  ListProjectIdsInput,
  MemoryStore,
  SaveProjectMemoryInput,
  SaveUserMemoryInput,
} from './types/store.js';
import type { ProjectMemory, UserPreferencesMemory } from './types/memory.js';
import { validateProjectMemory, validateUserPreferencesMemory } from './validateMemory.js';

const CREATE_USER_MEMORY = `
  CREATE TABLE IF NOT EXISTS user_memory (
    user_id text PRIMARY KEY,
    memory_json jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )
`;

const CREATE_PROJECT_MEMORY = `
  CREATE TABLE IF NOT EXISTS project_memory (
    user_id text NOT NULL,
    project_id text NOT NULL,
    memory_json jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, project_id)
  )
`;

export class DbMemoryStore implements MemoryStore {
  private readonly clientFactory: SqlClientFactory;
  private readonly autoInitSchema: boolean;
  private clientPromise: Promise<SqlClient> | undefined;
  private schemaPromise: Promise<void> | undefined;

  /**
   * Provide EITHER a ready `client` (tests / custom adapters) OR a
   * `clientFactory` (production, so the driver connects lazily on first use).
   * `autoInitSchema` (default true) issues idempotent `CREATE TABLE IF NOT
   * EXISTS` statements once per process before the first operation.
   */
  constructor({
    client,
    clientFactory,
    autoInitSchema = true,
  }: {
    client?: SqlClient;
    clientFactory?: SqlClientFactory;
    autoInitSchema?: boolean;
  }) {
    if (client === undefined && clientFactory === undefined) {
      throw new MemoryStoreError('CONFIG', 'DbMemoryStore requires a client or clientFactory.');
    }
    this.clientFactory = clientFactory ?? (() => client as SqlClient);
    this.autoInitSchema = autoInitSchema;
  }

  async getUserMemory({ userId }: GetUserMemoryInput): Promise<UserPreferencesMemory | undefined> {
    const client = await this.ready();
    const rows = await this.run<{ memory_json: unknown }>({
      client,
      text: 'SELECT memory_json FROM user_memory WHERE user_id = $1',
      params: [userId],
    });
    if (rows.length === 0) return undefined;
    return this.validateRow({
      raw: rows[0]?.memory_json,
      validate: validateUserPreferencesMemory,
      table: 'user_memory',
    });
  }

  async saveUserMemory({ userId, memory }: SaveUserMemoryInput): Promise<void> {
    const validated = validateUserPreferencesMemory(memory);
    const client = await this.ready();
    await this.run({
      client,
      text: `INSERT INTO user_memory (user_id, memory_json, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (user_id) DO UPDATE SET memory_json = EXCLUDED.memory_json, updated_at = now()`,
      params: [userId, validated],
    });
  }

  async getProjectMemory({
    userId,
    projectId,
  }: GetProjectMemoryInput): Promise<ProjectMemory | undefined> {
    const client = await this.ready();
    const rows = await this.run<{ memory_json: unknown }>({
      client,
      text: 'SELECT memory_json FROM project_memory WHERE user_id = $1 AND project_id = $2',
      params: [userId, projectId],
    });
    if (rows.length === 0) return undefined;
    return this.validateRow({
      raw: rows[0]?.memory_json,
      validate: validateProjectMemory,
      table: 'project_memory',
    });
  }

  async saveProjectMemory({ userId, projectId, memory }: SaveProjectMemoryInput): Promise<void> {
    const validated = validateProjectMemory(memory);
    const client = await this.ready();
    await this.run({
      client,
      text: `INSERT INTO project_memory (user_id, project_id, memory_json, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id, project_id)
       DO UPDATE SET memory_json = EXCLUDED.memory_json, updated_at = now()`,
      params: [userId, projectId, validated],
    });
  }

  async clearProjectMemory({ userId, projectId }: ClearProjectMemoryInput): Promise<void> {
    const client = await this.ready();
    await this.run({
      client,
      text: 'DELETE FROM project_memory WHERE user_id = $1 AND project_id = $2',
      params: [userId, projectId],
    });
  }

  async listProjectIds({ userId }: ListProjectIdsInput): Promise<string[]> {
    const client = await this.ready();
    const rows = await this.run<{ project_id: string }>({
      client,
      text: 'SELECT project_id FROM project_memory WHERE user_id = $1 ORDER BY updated_at DESC',
      params: [userId],
    });
    return rows.map((row) => row.project_id);
  }

  /** Resolve the client (once) and ensure the schema exists (once) before use. */
  private async ready(): Promise<SqlClient> {
    const client = await this.client();
    if (this.autoInitSchema) {
      if (this.schemaPromise === undefined) {
        this.schemaPromise = this.initSchema(client).catch((err: unknown) => {
          // Allow a later operation to retry schema creation after a transient failure.
          this.schemaPromise = undefined;
          throw err;
        });
      }
      await this.schemaPromise;
    }
    return client;
  }

  private async client(): Promise<SqlClient> {
    if (this.clientPromise === undefined) {
      this.clientPromise = Promise.resolve(this.clientFactory());
    }
    return this.clientPromise;
  }

  private async initSchema(client: SqlClient): Promise<void> {
    try {
      await client.query(CREATE_USER_MEMORY);
      await client.query(CREATE_PROJECT_MEMORY);
    } catch (err) {
      throw new MemoryStoreError('IO', `Failed to initialize memory schema: ${describe(err)}`);
    }
  }

  private async run<Row>({
    client,
    text,
    params,
  }: {
    client: SqlClient;
    text: string;
    params: readonly unknown[];
  }): Promise<Row[]> {
    try {
      const result = await client.query<Row>(text, params);
      return result.rows;
    } catch (err) {
      if (err instanceof MemoryStoreError) throw err;
      throw new MemoryStoreError('IO', `Database operation failed: ${describe(err)}`);
    }
  }

  private validateRow<T>({
    raw,
    validate,
    table,
  }: {
    raw: unknown;
    validate: (v: unknown) => T;
    table: string;
  }): T {
    const value = typeof raw === 'string' ? safeParse({ text: raw, table }) : raw;
    try {
      return validate(value);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new MemoryStoreError('CORRUPTED', `Memory row in ${table} has an invalid shape: ${detail}`);
    }
  }
}

function safeParse({ text, table }: { text: string; table: string }): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new MemoryStoreError('CORRUPTED', `Memory row in ${table} is not valid JSON.`);
  }
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
