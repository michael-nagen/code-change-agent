/**
 * The ProjectStore abstraction.
 *
 * It stores and retrieves whole Project objects. It runs no analysis, calls no
 * skills, and calls no adapters — it only persists and reads Projects, plus
 * maintains the project's list of owned session ids. The V1 implementation is
 * in-memory; the interface is intentionally narrow so it can later be backed by
 * a database or file store without changing any caller.
 */
import type {
  Project,
  ProjectPlugins,
  ProjectPreferences,
} from './project.js';

export interface CreateProjectInput {
  name: string;
  plugins?: ProjectPlugins;
  preferences?: ProjectPreferences;
}

export interface GetProjectInput {
  projectId: string;
}

export interface UpdateProjectInput {
  projectId: string;
  name?: string;
  plugins?: ProjectPlugins;
  preferences?: ProjectPreferences;
}

export interface AttachSessionToProjectInput {
  projectId: string;
  sessionId: string;
}

export interface ProjectStore {
  /** Create and store a new project, returning the stored snapshot. */
  createProject(input: CreateProjectInput): Project;
  /** Retrieve a project by id, or undefined if it does not exist. */
  getProject(input: GetProjectInput): Project | undefined;
  /** Update a project's name, plugins, and/or preferences; returns the snapshot. */
  updateProject(input: UpdateProjectInput): Project;
  /** List all stored projects. */
  listProjects(): Project[];
  /** Record that a session belongs to a project; returns the project snapshot. */
  attachSessionToProject(input: AttachSessionToProjectInput): Project;
}
