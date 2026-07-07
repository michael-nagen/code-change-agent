export { CodeUnderstandingHarness } from './harness/CodeUnderstandingHarness.js';
export type { StepOptions, GenerateParams } from './harness/CodeUnderstandingHarness.js';
export { SessionStore } from './harness/SessionStore.js';
export { HarnessError } from './errors/HarnessError.js';
export type { HarnessErrorCode } from './errors/HarnessError.js';
export { ToolError } from './errors/ToolError.js';
export type { ToolErrorCode } from './errors/ToolError.js';
export { SkillError } from './errors/SkillError.js';
export type { SkillErrorCode } from './errors/SkillError.js';
export { ProjectStoreError } from './errors/ProjectStoreError.js';
export type { ProjectStoreErrorCode } from './errors/ProjectStoreError.js';
export { validateInputs } from './validation/validateInputs.js';

export {
  MockChangeUnderstandingSkill,
  MockReportGenerationSkill,
  MockLanguageModel,
  FakeLanguageModel,
} from './skills/mocks/index.js';

export type { LanguageModel, LanguageModelInput, LanguageModelOutput } from './llm/LanguageModel.js';
export {
  OpenAICompatibleLanguageModel,
} from './llm/OpenAICompatibleLanguageModel.js';
export type { OpenAICompatibleConfig } from './llm/OpenAICompatibleLanguageModel.js';
export { LanguageModelError } from './errors/LanguageModelError.js';
export type { LanguageModelErrorCode } from './errors/LanguageModelError.js';

export { DefaultChangeExplanationSkill } from './skills/changeExplanation/index.js';
export { buildPrompt, parseOutput } from './skills/changeExplanation/index.js';
export type {
  ChangeExplanationInput,
  ChangeExplanation,
  ChangeExplanationSkill,
} from './skills/changeExplanation/index.js';

export { DefaultRequirementAlignmentSkill } from './skills/requirementAlignment/index.js';
export type {
  RequirementAlignmentInput,
  RequirementAlignment,
  RequirementAlignmentSkill,
} from './skills/requirementAlignment/index.js';

export { DefaultGapReportSkill } from './skills/gapReport/index.js';
export type {
  GapReportInput,
  GapReport,
  GapReportSkill,
  Readiness,
} from './skills/gapReport/index.js';

export { DefaultFlowGenerationSkill } from './skills/flowGeneration/index.js';
export type {
  FlowGenerationInput,
  FlowArtifact,
  FlowGenerationSkill,
} from './skills/flowGeneration/index.js';

export { DefaultVideoScriptSkill } from './skills/videoScript/index.js';
export type {
  VideoScriptInput,
  VideoScript,
  VideoScriptSection,
  VideoScriptSkill,
} from './skills/videoScript/index.js';

export { DefaultPRDescriptionSkill } from './skills/prDescription/index.js';
export type {
  PRDescriptionInput,
  PRDescription,
  PRDescriptionSkill,
} from './skills/prDescription/index.js';

export { DefaultDailyUpdateSkill } from './skills/dailyUpdate/index.js';
export type {
  DailyUpdateInput,
  DailyUpdate,
  HighlightedTopic,
  DailyUpdateSkill,
} from './skills/dailyUpdate/index.js';

export { DefaultArtifactEditSkill } from './skills/artifactEdit/index.js';
export { MockArtifactEditSkill } from './skills/mocks/index.js';
export type {
  ArtifactEditInput,
  ArtifactEditResult,
  ArtifactEditSessionContext,
  ArtifactEditSkill,
  ChatMessage,
  EditableArtifactKey,
  EditableArtifact,
} from './skills/artifactEdit/index.js';

export {
  AnalysisHarness,
  InMemoryArtifactStore,
  DefaultSkillRegistry,
  runAnalyzeCodeChange,
  ANALYZE_CODE_CHANGE_WORKFLOW,
  assertWorkflowIncludeFlags,
} from './analysis/index.js';
export type {
  AnalysisHarnessDeps,
  AnalysisSession,
  AnalysisInputs,
  AnalysisArtifacts,
  WorkflowStatus,
  WorkflowStepName,
  SessionMetadata,
  ArtifactStore,
  SkillRegistry,
  RegisteredSkills,
  SkillKey,
  AnalysisResult,
  AnalysisIncludeFlags,
  WorkflowStepDefinition,
} from './analysis/index.js';

export { DefaultGitDiffReaderTool, DefaultGitInputAdapter } from './tools/index.js';
export type {
  GitDiffReaderTool,
  GitDiffReaderInput,
  GitDiffResult,
  GitInputAdapter,
  GitInputAdapterInput,
  GitAnalysisInput,
} from './tools/index.js';

export { ManualRequirementInputAdapter } from './tools/index.js';
export type {
  RequirementInput,
  RequirementInputAdapterInput,
  RequirementInputAdapter,
} from './tools/index.js';

export {
  DefaultNotionInputAdapter,
  DefaultNotionOutputAdapter,
  createNotionPlugin,
} from './tools/index.js';
export type {
  NotionInputAdapter,
  NotionInputAdapterInput,
  NotionRequirementInput,
  NotionOutputAdapter,
  NotionOutputAdapterInput,
  NotionOutputResult,
  NotionArtifacts,
  NotionPlugin,
} from './tools/index.js';

export { InMemoryProjectStore } from './project/index.js';
export type {
  Project,
  ProjectPlugins,
  ProjectPreferences,
  ProjectMetadata,
  GitPluginConnection,
  NotionPluginConnection,
  ProjectStore,
  CreateProjectInput,
  GetProjectInput,
  UpdateProjectInput,
  AttachSessionToProjectInput,
} from './project/index.js';

export type {
  SessionPhase,
  SessionInputs,
  ChangeUnderstanding,
  SessionOutputs,
  SessionState,
  ChangeUnderstandingInput,
  ChangeUnderstandingSkill,
  OutputKey,
  OutputGenerator,
  ReportGenerationSkill,
  HarnessSkills,
} from './types/index.js';
