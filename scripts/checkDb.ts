/**
 * Manual / ops verification for the DB-backed MemoryStore.
 *
 * Run with:  npm run check:db
 *
 * It answers one question: "is my Postgres (e.g. Supabase) connection and the DB
 * memory store actually working?" It exercises the SAME code the app uses —
 * `resolveMemoryStore` for selection and `DbMemoryStore` over the real `pg`
 * driver for reads/writes — against a clearly-namespaced test id, then cleans up
 * after itself.
 *
 * It is intentionally NOT a unit test (not under src/**.test.ts, never run by
 * `npm test`) because it needs a real database. `.env` is loaded automatically.
 *
 * Safety:
 *  - it NEVER prints DATABASE_URL, passwords, or any secret;
 *  - any error message is scrubbed of the connection string before printing;
 *  - it only touches a namespaced test user/project id, and deletes those rows
 *    at the end. It runs no migrations and drops nothing.
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

import {
  DbMemoryStore,
  createPgSqlClient,
  resolveMemoryStore,
  MEMORY_SCHEMA_VERSION,
  type SqlClient,
} from '../src/index.js';
import type { ProjectMemory, UserPreferencesMemory } from '../src/index.js';

/** A namespaced id that will not collide with real slugified project/user ids. */
const TEST_USER_ID = '__db_connectivity_check__';
const TEST_PROJECT_ID = '__db_connectivity_check__';

async function main(): Promise<void> {
  console.log('DB memory check\n');

  // 1. .env loaded — node --env-file-if-exists loads it before we run; report it.
  const envPresent = existsSync('.env');
  console.log(`.env file: ${envPresent ? 'found' : 'not found (using process env only)'}`);

  // 2. MEMORY_STORE must select the DB store.
  const memoryStore = process.env.MEMORY_STORE ?? 'file';
  console.log(`MEMORY_STORE: ${memoryStore}`);
  if (memoryStore !== 'db') {
    fail(
      `This check verifies the DB store, but MEMORY_STORE is "${memoryStore}". ` +
        'Set MEMORY_STORE=db in .env and try again.',
    );
  }

  // 3. DATABASE_URL presence only — never print the value.
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl === undefined || databaseUrl === '') {
    fail('DATABASE_URL is missing. Set it in .env when MEMORY_STORE=db.');
  }
  console.log('DATABASE_URL: present');

  // Sanity: the resolver seam the UI/API use actually picks the DB store.
  const resolved = resolveMemoryStore(process.env);
  if (!(resolved instanceof DbMemoryStore)) {
    fail('resolveMemoryStore did not select the DB store even though MEMORY_STORE=db.');
  }

  let client: SqlClient | undefined;
  try {
    // 4. Postgres connection.
    client = await guard({
      label: 'Postgres connection',
      hint:
        'Check the Supabase password, host, port, and SSL requirements ' +
        '(special characters in the password must be URL-encoded).',
      run: async () => {
        const c = await createPgSqlClient({ databaseUrl });
        await c.query('SELECT 1');
        return c;
      },
    });

    // Use the SAME connection for the store so we control cleanup and pooling.
    const store = new DbMemoryStore({ client });

    // 5. Schema exists / is initialized (auto-init on first use, idempotent).
    await guard({
      label: 'Schema',
      hint:
        'Could not create/verify the memory tables. Ensure the database user may ' +
        'CREATE TABLE, or create user_memory/project_memory manually (see docs).',
      run: () => store.getUserMemory({ userId: TEST_USER_ID }),
    });

    // 6 + 7. User memory write/read round-trip.
    const userMemory = buildUserMemory();
    await guard({
      label: 'User memory write/read',
      hint: 'User memory write/read failed.',
      run: async () => {
        await store.saveUserMemory({ userId: TEST_USER_ID, memory: userMemory });
        const readBack = await store.getUserMemory({ userId: TEST_USER_ID });
        assert.deepStrictEqual(readBack, userMemory);
      },
    });

    // Project memory write/read round-trip.
    const projectMemory = buildProjectMemory();
    await guard({
      label: 'Project memory write/read',
      hint: 'Project memory write/read failed.',
      run: async () => {
        await store.saveProjectMemory({
          userId: TEST_USER_ID,
          projectId: TEST_PROJECT_ID,
          memory: projectMemory,
        });
        const readBack = await store.getProjectMemory({
          userId: TEST_USER_ID,
          projectId: TEST_PROJECT_ID,
        });
        assert.deepStrictEqual(readBack, projectMemory);
      },
    });

    // 8. Clear project memory and verify it is gone.
    await guard({
      label: 'Project memory clear',
      hint: 'Clearing project memory failed.',
      run: async () => {
        await store.clearProjectMemory?.({ userId: TEST_USER_ID, projectId: TEST_PROJECT_ID });
        const afterClear = await store.getProjectMemory({
          userId: TEST_USER_ID,
          projectId: TEST_PROJECT_ID,
        });
        assert.equal(afterClear, undefined);
      },
    });

    // Best-effort cleanup of the test user row (no clearUserMemory in the port).
    await client
      .query('DELETE FROM user_memory WHERE user_id = $1', [TEST_USER_ID])
      .catch(() => undefined);

    console.log('\nResult: DB memory is connected and working.');
  } finally {
    await client?.close?.().catch(() => undefined);
  }
}

function buildUserMemory(): UserPreferencesMemory {
  return {
    schemaVersion: MEMORY_SCHEMA_VERSION,
    userId: TEST_USER_ID,
    preferences: ['db connectivity probe'],
    updatedAt: new Date().toISOString(),
  };
}

function buildProjectMemory(): ProjectMemory {
  return {
    schemaVersion: MEMORY_SCHEMA_VERSION,
    userId: TEST_USER_ID,
    projectId: TEST_PROJECT_ID,
    history: [],
    updatedAt: new Date().toISOString(),
  };
}

/** Run a step, print "<label>: OK" on success, throw a friendly (scrubbed) error otherwise. */
async function guard<T>({
  label,
  hint,
  run,
}: {
  label: string;
  hint: string;
  run: () => Promise<T> | T;
}): Promise<T> {
  try {
    const result = await run();
    console.log(`${label}: OK`);
    return result;
  } catch (err) {
    const detail = scrub(err instanceof Error ? err.message : String(err));
    throw new CheckError(`${label} failed. ${hint}\n  detail: ${detail}`);
  }
}

/** Marker error whose message is safe to print verbatim (already scrubbed). */
class CheckError extends Error {}

function fail(message: string): never {
  throw new CheckError(message);
}

/**
 * Remove anything that could reveal the connection string from a message:
 * the full DATABASE_URL if it appears, and any `scheme://user:pass@` userinfo.
 */
function scrub(message: string): string {
  let out = message;
  const url = process.env.DATABASE_URL;
  if (url !== undefined && url !== '') {
    out = out.split(url).join('[redacted]');
  }
  return out.replace(/([a-z]+:\/\/)[^@\s]*@/gi, '$1[redacted]@');
}

main().catch((err: unknown) => {
  const message = err instanceof CheckError ? err.message : scrub(err instanceof Error ? err.message : String(err));
  console.error(`\nResult: FAILED\n${message}`);
  process.exit(1);
});
