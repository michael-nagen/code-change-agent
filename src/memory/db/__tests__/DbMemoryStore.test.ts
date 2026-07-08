import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DbMemoryStore } from '../../DbMemoryStore.js';
import { MemoryStoreError } from '../../../errors/MemoryStoreError.js';
import type { SqlClient, SqlQueryResult } from '../SqlClient.js';
import type { ProjectMemory, UserPreferencesMemory } from '../../types/index.js';

const USER_MEMORY: UserPreferencesMemory = {
  schemaVersion: 1,
  userId: 'local',
  preferences: ['prefers concise updates'],
  defaultGoal: 'ship the MVP',
  updatedAt: '2026-07-07T00:00:00.000Z',
};

const PROJECT_MEMORY: ProjectMemory = {
  schemaVersion: 1,
  userId: 'local',
  projectId: 'demo',
  latestSnapshot: {
    date: '2026-07-07',
    dailySummary: 'Planning stage done.',
    updatedChecklistStatuses: [{ item: 'Planning', status: 'done' }],
    openBlockers: [],
    openDecisions: [],
    nextActions: ['Persist plans'],
  },
  history: [],
  updatedAt: '2026-07-07T00:00:00.000Z',
};

/**
 * An in-memory double for the `SqlClient` port. It understands only the exact
 * statements the store issues (parameterized), mimicking Postgres `jsonb`
 * round-tripping by storing/returning the JS object as-is.
 */
class FakeSqlClient implements SqlClient {
  readonly executed: string[] = [];
  private readonly users = new Map<string, unknown>();
  private readonly projects = new Map<string, unknown>();

  async query<Row>(text: string, params: readonly unknown[] = []): Promise<SqlQueryResult<Row>> {
    const sql = text.trim();
    this.executed.push(sql);

    if (sql.startsWith('CREATE TABLE')) return { rows: [] };

    if (sql.startsWith('INSERT INTO user_memory')) {
      this.users.set(String(params[0]), params[1]);
      return { rows: [] };
    }
    if (sql.startsWith('SELECT memory_json FROM user_memory')) {
      const found = this.users.get(String(params[0]));
      return { rows: found === undefined ? [] : [{ memory_json: found } as Row] };
    }
    if (sql.startsWith('INSERT INTO project_memory')) {
      this.projects.set(key(params[0], params[1]), params[2]);
      return { rows: [] };
    }
    if (sql.startsWith('SELECT memory_json FROM project_memory')) {
      const found = this.projects.get(key(params[0], params[1]));
      return { rows: found === undefined ? [] : [{ memory_json: found } as Row] };
    }
    if (sql.startsWith('DELETE FROM project_memory')) {
      this.projects.delete(key(params[0], params[1]));
      return { rows: [] };
    }
    throw new Error(`FakeSqlClient: unexpected SQL: ${sql}`);
  }
}

function key(userId: unknown, projectId: unknown): string {
  return `${String(userId)}\u0000${String(projectId)}`;
}

test('creates schema once before the first operation', async () => {
  const client = new FakeSqlClient();
  const store = new DbMemoryStore({ client });

  await store.getUserMemory({ userId: 'local' });
  await store.getProjectMemory({ userId: 'local', projectId: 'demo' });

  const creates = client.executed.filter((s) => s.startsWith('CREATE TABLE'));
  assert.equal(creates.length, 2, 'both tables created exactly once across operations');
});

test('missing rows read as undefined (no crash)', async () => {
  const store = new DbMemoryStore({ client: new FakeSqlClient() });
  assert.equal(await store.getUserMemory({ userId: 'local' }), undefined);
  assert.equal(await store.getProjectMemory({ userId: 'local', projectId: 'demo' }), undefined);
});

test('persists and reloads user + project memory', async () => {
  const store = new DbMemoryStore({ client: new FakeSqlClient() });

  await store.saveUserMemory({ userId: 'local', memory: USER_MEMORY });
  await store.saveProjectMemory({ userId: 'local', projectId: 'demo', memory: PROJECT_MEMORY });

  assert.deepEqual(await store.getUserMemory({ userId: 'local' }), USER_MEMORY);
  assert.deepEqual(await store.getProjectMemory({ userId: 'local', projectId: 'demo' }), PROJECT_MEMORY);
});

test('saving twice upserts rather than duplicating', async () => {
  const client = new FakeSqlClient();
  const store = new DbMemoryStore({ client });
  await store.saveProjectMemory({ userId: 'local', projectId: 'demo', memory: PROJECT_MEMORY });
  const updated: ProjectMemory = { ...PROJECT_MEMORY, updatedAt: '2026-07-08T00:00:00.000Z' };
  await store.saveProjectMemory({ userId: 'local', projectId: 'demo', memory: updated });
  assert.deepEqual(await store.getProjectMemory({ userId: 'local', projectId: 'demo' }), updated);
});

test('clearProjectMemory removes the row', async () => {
  const store = new DbMemoryStore({ client: new FakeSqlClient() });
  await store.saveProjectMemory({ userId: 'local', projectId: 'demo', memory: PROJECT_MEMORY });
  await store.clearProjectMemory?.({ userId: 'local', projectId: 'demo' });
  assert.equal(await store.getProjectMemory({ userId: 'local', projectId: 'demo' }), undefined);
});

test('a jsonb value returned as a JSON string is parsed', async () => {
  const client: SqlClient = {
    async query<Row>(text: string): Promise<SqlQueryResult<Row>> {
      if (text.trim().startsWith('SELECT memory_json FROM user_memory')) {
        return { rows: [{ memory_json: JSON.stringify(USER_MEMORY) } as Row] };
      }
      return { rows: [] };
    },
  };
  const store = new DbMemoryStore({ client, autoInitSchema: false });
  assert.deepEqual(await store.getUserMemory({ userId: 'local' }), USER_MEMORY);
});

test('a corrupted row fails closed with a CORRUPTED error', async () => {
  const client: SqlClient = {
    async query<Row>(text: string): Promise<SqlQueryResult<Row>> {
      if (text.trim().startsWith('SELECT memory_json FROM project_memory')) {
        return { rows: [{ memory_json: { not: 'a valid project memory' } } as Row] };
      }
      return { rows: [] };
    },
  };
  const store = new DbMemoryStore({ client, autoInitSchema: false });
  await assert.rejects(
    () => store.getProjectMemory({ userId: 'local', projectId: 'demo' }),
    (err: unknown) => err instanceof MemoryStoreError && err.code === 'CORRUPTED',
  );
});

test('a database failure surfaces as an IO error', async () => {
  const client: SqlClient = {
    async query<Row>(): Promise<SqlQueryResult<Row>> {
      throw new Error('connection refused');
    },
  };
  const store = new DbMemoryStore({ client, autoInitSchema: false });
  await assert.rejects(
    () => store.getUserMemory({ userId: 'local' }),
    (err: unknown) => err instanceof MemoryStoreError && err.code === 'IO',
  );
});

test('constructing without a client or factory throws a CONFIG error', () => {
  assert.throws(
    () => new DbMemoryStore({}),
    (err: unknown) => err instanceof MemoryStoreError && err.code === 'CONFIG',
  );
});
