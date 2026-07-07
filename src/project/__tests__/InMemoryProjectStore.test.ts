import { test } from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryProjectStore } from '../InMemoryProjectStore.js';
import { ProjectStoreError } from '../../errors/ProjectStoreError.js';

test('creates a project with defaults and a generated id', () => {
  const store = new InMemoryProjectStore();

  const project = store.createProject({ name: 'Checkout service' });

  assert.equal(typeof project.projectId, 'string');
  assert.ok(project.projectId.length > 0);
  assert.equal(project.name, 'Checkout service');
  assert.deepEqual(project.sessions, []);
  assert.deepEqual(project.plugins, {});
  assert.equal(project.preferences, undefined);
  assert.ok(project.metadata.createdAt instanceof Date);
  assert.ok(project.metadata.updatedAt instanceof Date);
});

test('gets a stored project by id', () => {
  const store = new InMemoryProjectStore();
  const created = store.createProject({ name: 'Checkout service' });

  const fetched = store.getProject({ projectId: created.projectId });

  assert.ok(fetched);
  assert.equal(fetched.projectId, created.projectId);
  assert.equal(fetched.name, 'Checkout service');
});

test('returns undefined for an unknown project', () => {
  const store = new InMemoryProjectStore();

  assert.equal(store.getProject({ projectId: 'missing' }), undefined);
});

test('lists all stored projects', () => {
  const store = new InMemoryProjectStore();
  store.createProject({ name: 'A' });
  store.createProject({ name: 'B' });

  const names = store.listProjects().map((p) => p.name).sort();

  assert.deepEqual(names, ['A', 'B']);
});

test('creates a project with plugin configuration (config only, no credentials)', () => {
  const store = new InMemoryProjectStore();

  const project = store.createProject({
    name: 'Checkout service',
    plugins: {
      git: { repoPath: '/repos/checkout', defaultBaseRef: 'main' },
      notion: { pageId: 'page-1', workspaceName: 'Acme' },
    },
  });

  assert.deepEqual(project.plugins.git, {
    repoPath: '/repos/checkout',
    defaultBaseRef: 'main',
  });
  assert.deepEqual(project.plugins.notion, { pageId: 'page-1', workspaceName: 'Acme' });
});

test('updates project plugin configuration, merging connections shallowly', () => {
  const store = new InMemoryProjectStore();
  const created = store.createProject({
    name: 'Checkout service',
    plugins: { git: { repoPath: '/repos/checkout' } },
  });

  const updated = store.updateProject({
    projectId: created.projectId,
    plugins: { notion: { pageId: 'page-1' } },
  });

  assert.deepEqual(updated.plugins.git, { repoPath: '/repos/checkout' });
  assert.deepEqual(updated.plugins.notion, { pageId: 'page-1' });
});

test('stores and merges project preferences', () => {
  const store = new InMemoryProjectStore();
  const created = store.createProject({
    name: 'Checkout service',
    preferences: { includeFlowByDefault: true },
  });

  const updated = store.updateProject({
    projectId: created.projectId,
    preferences: { includePrDescriptionByDefault: true },
  });

  assert.deepEqual(updated.preferences, {
    includeFlowByDefault: true,
    includePrDescriptionByDefault: true,
  });
});

test('updates the project name', () => {
  const store = new InMemoryProjectStore();
  const created = store.createProject({ name: 'Old name' });

  const updated = store.updateProject({ projectId: created.projectId, name: 'New name' });

  assert.equal(updated.name, 'New name');
});

test('attaches a session to a project', () => {
  const store = new InMemoryProjectStore();
  const created = store.createProject({ name: 'Checkout service' });

  const updated = store.attachSessionToProject({
    projectId: created.projectId,
    sessionId: 'session-1',
  });

  assert.deepEqual(updated.sessions, ['session-1']);
});

test('attaching the same session twice is idempotent', () => {
  const store = new InMemoryProjectStore();
  const created = store.createProject({ name: 'Checkout service' });

  store.attachSessionToProject({ projectId: created.projectId, sessionId: 'session-1' });
  const updated = store.attachSessionToProject({
    projectId: created.projectId,
    sessionId: 'session-1',
  });

  assert.deepEqual(updated.sessions, ['session-1']);
});

test('throws when updating an unknown project', () => {
  const store = new InMemoryProjectStore();

  assert.throws(
    () => store.updateProject({ projectId: 'missing', name: 'x' }),
    (err: unknown) => err instanceof ProjectStoreError && err.code === 'NOT_FOUND',
  );
});

test('throws when attaching a session to an unknown project', () => {
  const store = new InMemoryProjectStore();

  assert.throws(
    () => store.attachSessionToProject({ projectId: 'missing', sessionId: 's1' }),
    (err: unknown) => err instanceof ProjectStoreError && err.code === 'NOT_FOUND',
  );
});

test('rejects an empty project name', () => {
  const store = new InMemoryProjectStore();

  assert.throws(
    () => store.createProject({ name: '   ' }),
    (err: unknown) => err instanceof ProjectStoreError && err.code === 'VALIDATION',
  );
});

test('returns isolated snapshots so callers cannot mutate stored state', () => {
  const store = new InMemoryProjectStore();
  const created = store.createProject({ name: 'Checkout service' });

  created.sessions.push('leaked');
  created.name = 'mutated';

  const fetched = store.getProject({ projectId: created.projectId });
  assert.ok(fetched);
  assert.deepEqual(fetched.sessions, []);
  assert.equal(fetched.name, 'Checkout service');
});

test('the store exposes only storage operations (no analysis, skills, or adapters)', () => {
  const store = new InMemoryProjectStore() as unknown as Record<string, unknown>;

  for (const method of ['createProject', 'getProject', 'updateProject', 'listProjects', 'attachSessionToProject']) {
    assert.equal(typeof store[method], 'function');
  }
  for (const forbidden of ['runAnalysis', 'execute', 'resolve', 'registry']) {
    assert.equal(forbidden in store, false);
  }
});
