/**
 * The real Postgres adapter for the `SqlClient` port.
 *
 * It wraps a `pg` connection pool created from a `DATABASE_URL` connection
 * string (the standard for Postgres/Supabase/Neon/RDS). `pg` is imported lazily
 * so the dependency is only loaded when DB mode is actually used — selecting a
 * different `MEMORY_STORE` never touches this code.
 *
 * Safety:
 *  - the connection string is never logged;
 *  - `pg` serializes object params to JSON for `jsonb` columns automatically;
 *  - queries are always parameterized by the store, so values are never injected.
 */
import { MemoryStoreError } from '../../errors/MemoryStoreError.js';
import type { SqlClient, SqlQueryResult } from './SqlClient.js';

/** The subset of the `pg` Pool we depend on, so the driver stays behind the port. */
interface PgPoolLike {
  query(text: string, params?: readonly unknown[]): Promise<{ rows: unknown[] }>;
  end(): Promise<void>;
}

/**
 * Create a Postgres-backed `SqlClient` from a connection string. The pool is
 * created eagerly (cheap; `pg` connects lazily on first query) but the `pg`
 * module is imported on demand so non-DB modes never require it to be installed.
 */
export async function createPgSqlClient({
  databaseUrl,
}: {
  databaseUrl: string;
}): Promise<SqlClient> {
  if (databaseUrl.trim() === '') {
    throw new MemoryStoreError('CONFIG', 'A DATABASE_URL connection string is required for DB memory.');
  }

  let PoolCtor: new (config: { connectionString: string }) => PgPoolLike;
  try {
    const pg = (await import('pg')) as unknown as {
      default?: { Pool: new (config: { connectionString: string }) => PgPoolLike };
      Pool?: new (config: { connectionString: string }) => PgPoolLike;
    };
    const resolved = pg.Pool ?? pg.default?.Pool;
    if (resolved === undefined) {
      throw new Error('the pg module did not export a Pool constructor');
    }
    PoolCtor = resolved;
  } catch (err) {
    // Do NOT include the connection string in the message.
    throw new MemoryStoreError(
      'CONFIG',
      `Could not load the Postgres driver ("pg"). Install it to use MEMORY_STORE=db: ${describe(err)}`,
    );
  }

  const pool = new PoolCtor({ connectionString: databaseUrl });

  return {
    async query<Row>(text: string, params?: readonly unknown[]): Promise<SqlQueryResult<Row>> {
      const result = await pool.query(text, params);
      return { rows: result.rows as Row[] };
    },
    async close(): Promise<void> {
      await pool.end();
    },
  };
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
