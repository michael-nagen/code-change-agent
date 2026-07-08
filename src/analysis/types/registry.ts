/**
 * The SkillRegistry abstraction.
 *
 * The Harness and workflow resolve skills by key rather than referencing
 * concrete classes, so skills stay swappable (mock vs. real, any model
 * provider). Adding a future skill — PRDescriptionSkill, ReportGenerationSkill,
 * PresentationSkill, VideoScriptSkill — means adding one entry to
 * `RegisteredSkills` and registering an instance; resolution stays type-safe.
 */
import type { ChangeExplanationSkill } from '../../skills/changeExplanation/index.js';
import type { RequirementAlignmentSkill } from '../../skills/requirementAlignment/index.js';
import type { GapReportSkill } from '../../skills/gapReport/index.js';
import type { FlowGenerationSkill } from '../../skills/flowGeneration/index.js';
import type { VideoScriptSkill } from '../../skills/videoScript/index.js';
import type { PRDescriptionSkill } from '../../skills/prDescription/index.js';
import type { DailyUpdateSkill } from '../../skills/dailyUpdate/index.js';
import type { DailyWorkGuidanceSkill } from '../../skills/dailyWorkGuidance/index.js';
import type { TechnicalChangeBriefSkill } from '../../skills/technicalChangeBrief/index.js';
import type { DemoPrepLoopSkill } from '../../skills/demoPrepLoop/index.js';
import type { WeeklyReviewSkill } from '../../skills/weeklyReview/index.js';
import type { GuidanceCritiqueSkill } from '../../skills/dailyWorkGuidanceCritique/index.js';

/** Maps each skill key to the interface an implementation must satisfy. */
export interface RegisteredSkills {
  changeExplanation: ChangeExplanationSkill;
  flowGeneration: FlowGenerationSkill;
  requirementAlignment: RequirementAlignmentSkill;
  gapReport: GapReportSkill;
  videoScript: VideoScriptSkill;
  prDescription: PRDescriptionSkill;
  dailyUpdate: DailyUpdateSkill;
  dailyWorkGuidance: DailyWorkGuidanceSkill;
  /** The bounded self-critique pass over a generated guidance plan. */
  dailyWorkGuidanceCritique: GuidanceCritiqueSkill;
  technicalChangeBrief: TechnicalChangeBriefSkill;
  demoPrepLoop: DemoPrepLoopSkill;
  weeklyReview: WeeklyReviewSkill;
}

export type SkillKey = keyof RegisteredSkills;

export interface SkillRegistry {
  register<K extends SkillKey>(entry: { key: K; skill: RegisteredSkills[K] }): void;
  resolve<K extends SkillKey>(key: K): RegisteredSkills[K];
}
