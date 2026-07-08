/**
 * Persistent, JSON file-backed MemoryStore — the MVP durable implementation.
 *
 * Layout under the configured data directory:
 *   <dataDir>/users/<userId>.json
 *   <dataDir>/projects/<userId>/<projectId>.json
 *
 * Durability behavior:
 *  - directories are created on demand;
 *  - reads treat a missing file as "no memory" (undefined);
 *  - writes are atomic (write a temp file, then rename over the target);
 *  - parsed JSON is shape-validated before use;
 *  - a corrupted/invalid file throws `MemoryStoreError('CORRUPTED')` with the
 *    path, so callers can surface a clear load error instead of crashing.
 *
 * It is intentionally storage-agnostic behind `MemoryStore`: swapping this for a
 * Postgres/Mongo/Supabase/Redis/Notion store requires no caller changes.
 */
import { mkdir, readFile, readdir, writeFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { MemoryStoreError } from '../errors/MemoryStoreError.js';
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

/** Allowed id characters. Anything else is rejected to keep paths safe. */
const SAFE_ID = /^[A-Za-z0-9._-]+$/;

export class JsonFileMemoryStore implements MemoryStore {
  private readonly dataDir: string;

  constructor({ dataDir }: { dataDir: string }) {
    this.dataDir = dataDir;
  }

  async getUserMemory({ userId }: GetUserMemoryInput): Promise<UserPreferencesMemory | undefined> {
    return this.readValidated({
      path: this.userPath(userId),
      validate: validateUserPreferencesMemory,
    });
  }

  async saveUserMemory({ userId, memory }: SaveUserMemoryInput): Promise<void> {
    const validated = validateUserPreferencesMemory(memory);
    await this.writeAtomic({ path: this.userPath(userId), value: validated });
  }

  async getProjectMemory({
    userId,
    projectId,
  }: GetProjectMemoryInput): Promise<ProjectMemory | undefined> {
    return this.readValidated({
      path: this.projectPath({ userId, projectId }),
      validate: validateProjectMemory,
    });
  }

  async saveProjectMemory({ userId, projectId, memory }: SaveProjectMemoryInput): Promise<void> {
    const validated = validateProjectMemory(memory);
    await this.writeAtomic({ path: this.projectPath({ userId, projectId }), value: validated });
  }

  async clearProjectMemory({ userId, projectId }: ClearProjectMemoryInput): Promise<void> {
    try {
      await unlink(this.projectPath({ userId, projectId }));
    } catch (err) {
      if (!isNotFound(err)) {
        throw new MemoryStoreError('IO', `Failed to clear project memory: ${describe(err)}`);
      }
    }
  }

  async listProjectIds({ userId }: ListProjectIdsInput): Promise<string[]> {
    const dir = join(this.dataDir, 'projects', safeSegment(userId));
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch (err) {
      if (isNotFound(err)) return [];
      throw new MemoryStoreError('IO', `Failed to list projects: ${describe(err)}`);
    }
    return entries
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.slice(0, -'.json'.length))
      .sort((a, b) => a.localeCompare(b));
  }

  private userPath(userId: string): string {
    return join(this.dataDir, 'users', `${safeSegment(userId)}.json`);
  }

  private projectPath({ userId, projectId }: { userId: string; projectId: string }): string {
    return join(this.dataDir, 'projects', safeSegment(userId), `${safeSegment(projectId)}.json`);
  }

  private async readValidated<T>({
    path,
    validate,
  }: {
    path: string;
    validate: (raw: unknown) => T;
  }): Promise<T | undefined> {
    let text: string;
    try {
      text = await readFile(path, 'utf8');
    } catch (err) {
      if (isNotFound(err)) return undefined;
      throw new MemoryStoreError('IO', `Failed to read memory at ${path}: ${describe(err)}`);
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new MemoryStoreError('CORRUPTED', `Memory file is not valid JSON: ${path}`);
    }

    try {
      return validate(raw);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new MemoryStoreError('CORRUPTED', `Memory file has an invalid shape (${path}): ${detail}`);
    }
  }

  private async writeAtomic({ path, value }: { path: string; value: unknown }): Promise<void> {
    const dir = join(path, '..');
    const tmp = `${path}.${randomUUID()}.tmp`;
    try {
      await mkdir(dir, { recursive: true });
      await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
      await rename(tmp, path);
    } catch (err) {
      await unlink(tmp).catch(() => undefined);
      throw new MemoryStoreError('IO', `Failed to write memory at ${path}: ${describe(err)}`);
    }
  }
}

function safeSegment(id: string): string {
  if (!SAFE_ID.test(id)) {
    throw new MemoryStoreError(
      'VALIDATION',
      `Unsafe memory id "${id}". Ids must match ${SAFE_ID}.`,
    );
  }
  return id;
}

function isNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'ENOENT';
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
