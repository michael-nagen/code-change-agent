/**
 * The storage-agnostic MemoryStore interface.
 *
 * The rest of the app depends ONLY on this interface, never on how memory is
 * stored. The MVP ships a JSON file-backed implementation and an in-memory
 * implementation for tests; either can later be swapped for Postgres, Mongo,
 * Supabase, Redis, or a Notion-backed store without touching callers.
 *
 * All methods take a single object argument and are async so a networked store
 * (DB/cloud) is a drop-in replacement for the local file store.
 */
import type { ProjectMemory, UserPreferencesMemory } from './memory.js';

export interface GetUserMemoryInput {
  userId: string;
}

export interface SaveUserMemoryInput {
  userId: string;
  memory: UserPreferencesMemory;
}

export interface GetProjectMemoryInput {
  userId: string;
  projectId: string;
}

export interface SaveProjectMemoryInput {
  userId: string;
  projectId: string;
  memory: ProjectMemory;
}

export interface ClearProjectMemoryInput {
  userId: string;
  projectId: string;
}

export interface MemoryStore {
  getUserMemory(input: GetUserMemoryInput): Promise<UserPreferencesMemory | undefined>;
  saveUserMemory(input: SaveUserMemoryInput): Promise<void>;

  getProjectMemory(input: GetProjectMemoryInput): Promise<ProjectMemory | undefined>;
  saveProjectMemory(input: SaveProjectMemoryInput): Promise<void>;

  clearProjectMemory?(input: ClearProjectMemoryInput): Promise<void>;
}
