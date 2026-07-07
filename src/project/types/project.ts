/**
 * The Project model.
 *
 * A Project is the top-level workspace object for the code-change understanding
 * system. It represents a software project the user works on, and it owns
 * analysis sessions and plugin configuration.
 *
 * Deliberately NOT here: authentication, user profiles, OAuth, real credentials,
 * persistence, and long-term memory. A Project is a plain configuration + index
 * object. It holds no behavior and runs no analysis — the harness orchestrates
 * sessions, and the ProjectStore stores and retrieves Projects.
 */

/**
 * Project-level Git configuration. This is configuration only: it is NOT a
 * credential, stores no tokens, and connects to no external API. It only
 * records which repository and refs a project tends to analyze.
 */
export interface GitPluginConnection {
  repoPath: string;
  defaultBaseRef?: string;
  defaultHeadRef?: string;
}

/**
 * Project-level Notion configuration. This is configuration only: it is NOT a
 * credential, stores no tokens, and connects to no external API. It only
 * records which Notion page/workspace a project tends to read from or write to.
 */
export interface NotionPluginConnection {
  pageId?: string;
  pageUrl?: string;
  workspaceName?: string;
}

/** The plugin configuration a project carries. */
export interface ProjectPlugins {
  git?: GitPluginConnection;
  notion?: NotionPluginConnection;
}

/**
 * Default include flags a project prefers for its analyses. These are recorded
 * here for future use; this task does not apply them automatically.
 */
export interface ProjectPreferences {
  includeFlowByDefault?: boolean;
  includeGapReportByDefault?: boolean;
  includePrDescriptionByDefault?: boolean;
  includeVideoScriptByDefault?: boolean;
  includeDailyUpdateByDefault?: boolean;
}

/** Bookkeeping for a project. */
export interface ProjectMetadata {
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  projectId: string;
  name: string;
  /** Ids of the analysis sessions that belong to this project. */
  sessions: string[];
  plugins: ProjectPlugins;
  preferences?: ProjectPreferences;
  metadata: ProjectMetadata;
}
