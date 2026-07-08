/**
 * In-memory MemoryStore for tests and mocks ONLY.
 *
 * It is NOT persistent — everything is lost when the process exits. Use it in
 * tests, or when a caller explicitly opts out of durability. Production/local
 * runs should use a persistent store (see `JsonFileMemoryStore`).
 *
 * Records are validated on save and cloned on read/write so callers cannot
 * mutate stored state — mirroring the durable stores' guarantees.
 */
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

export class InMemoryMemoryStore implements MemoryStore {
  private readonly userMemory = new Map<string, UserPreferencesMemory>();
  private readonly projectMemory = new Map<string, ProjectMemory>();

  async getUserMemory({ userId }: GetUserMemoryInput): Promise<UserPreferencesMemory | undefined> {
    const found = this.userMemory.get(userId);
    return found === undefined ? undefined : structuredClone(found);
  }

  async saveUserMemory({ userId, memory }: SaveUserMemoryInput): Promise<void> {
    const validated = validateUserPreferencesMemory(memory);
    this.userMemory.set(userId, structuredClone(validated));
  }

  async getProjectMemory({
    userId,
    projectId,
  }: GetProjectMemoryInput): Promise<ProjectMemory | undefined> {
    const found = this.projectMemory.get(projectKey({ userId, projectId }));
    return found === undefined ? undefined : structuredClone(found);
  }

  async saveProjectMemory({ userId, projectId, memory }: SaveProjectMemoryInput): Promise<void> {
    const validated = validateProjectMemory(memory);
    this.projectMemory.set(projectKey({ userId, projectId }), structuredClone(validated));
  }

  async clearProjectMemory({ userId, projectId }: ClearProjectMemoryInput): Promise<void> {
    this.projectMemory.delete(projectKey({ userId, projectId }));
  }

  async listProjectIds({ userId }: ListProjectIdsInput): Promise<string[]> {
    const prefix = `${userId}\u0000`;
    return [...this.projectMemory.keys()]
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length))
      .sort((a, b) => a.localeCompare(b));
  }
}

function projectKey({ userId, projectId }: { userId: string; projectId: string }): string {
  return `${userId}\u0000${projectId}`;
}
