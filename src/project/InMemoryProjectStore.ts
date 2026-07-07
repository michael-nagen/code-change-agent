import { randomUUID } from 'node:crypto';
import { ProjectStoreError } from '../errors/ProjectStoreError.js';
import type {
  AttachSessionToProjectInput,
  CreateProjectInput,
  GetProjectInput,
  Project,
  ProjectStore,
  UpdateProjectInput,
} from './types/index.js';

/**
 * In-memory ProjectStore (V1: no persistence). Projects are cloned on the way
 * in and out so callers cannot mutate stored state by holding a reference — the
 * same isolation guarantee a database-backed store would provide.
 *
 * This store only stores and retrieves Projects (and maintains their owned
 * session id list). It never runs analysis, calls skills, or calls adapters.
 */
export class InMemoryProjectStore implements ProjectStore {
  private readonly projects = new Map<string, Project>();

  createProject({ name, plugins, preferences }: CreateProjectInput): Project {
    if (name.trim() === '') {
      throw new ProjectStoreError('VALIDATION', 'Project name must not be empty.');
    }

    const now = new Date();
    const project: Project = {
      projectId: randomUUID(),
      name,
      sessions: [],
      plugins: plugins ?? {},
      ...(preferences !== undefined ? { preferences } : {}),
      metadata: { createdAt: now, updatedAt: now },
    };

    this.projects.set(project.projectId, structuredClone(project));
    return structuredClone(project);
  }

  getProject({ projectId }: GetProjectInput): Project | undefined {
    const project = this.projects.get(projectId);
    return project === undefined ? undefined : structuredClone(project);
  }

  updateProject({ projectId, name, plugins, preferences }: UpdateProjectInput): Project {
    const project = this.requireProject(projectId);

    if (name !== undefined) {
      if (name.trim() === '') {
        throw new ProjectStoreError('VALIDATION', 'Project name must not be empty.');
      }
      project.name = name;
    }

    // Plugins and preferences are merged shallowly so callers can update one
    // connection (e.g. notion) without clearing the others.
    if (plugins !== undefined) {
      project.plugins = { ...project.plugins, ...plugins };
    }

    if (preferences !== undefined) {
      project.preferences = { ...project.preferences, ...preferences };
    }

    project.metadata.updatedAt = new Date();
    this.projects.set(projectId, project);
    return structuredClone(project);
  }

  listProjects(): Project[] {
    return Array.from(this.projects.values(), (project) => structuredClone(project));
  }

  attachSessionToProject({ projectId, sessionId }: AttachSessionToProjectInput): Project {
    const project = this.requireProject(projectId);

    if (!project.sessions.includes(sessionId)) {
      project.sessions.push(sessionId);
      project.metadata.updatedAt = new Date();
      this.projects.set(projectId, project);
    }

    return structuredClone(project);
  }

  private requireProject(projectId: string): Project {
    const project = this.projects.get(projectId);
    if (project === undefined) {
      throw new ProjectStoreError('NOT_FOUND', `Unknown project: ${projectId}`);
    }
    return project;
  }
}
