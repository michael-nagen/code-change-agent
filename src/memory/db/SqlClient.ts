/**
 * A minimal SQL client port for the DB-backed MemoryStore.
 *
 * The store depends ONLY on this tiny interface — never on a concrete driver —
 * so the real Postgres adapter and the test double are interchangeable, exactly
 * like the injected `SourceFetch` seam used by the source connectors. Keeping
 * the surface this small means no ORM and no driver leakage into store logic.
 */

/** The shape we read back from a query: just the rows. */
export interface SqlQueryResult<Row> {
  rows: Row[];
}

/**
 * A parameterized SQL client. Implementations MUST use bound parameters
 * (`$1`, `$2`, …) — never string interpolation — so values are never injected.
 */
export interface SqlClient {
  query<Row = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[],
  ): Promise<SqlQueryResult<Row>>;
  /** Release any underlying resources (connection pool). Optional for doubles. */
  close?(): Promise<void>;
}

/**
 * Lazily constructs a `SqlClient`. Used so the resolver can stay synchronous and
 * the concrete driver (e.g. `pg`) is only imported/connected when DB mode is
 * actually exercised — not merely selected.
 */
export type SqlClientFactory = () => SqlClient | Promise<SqlClient>;
