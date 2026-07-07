/**
 * The structured result returned by AnalysisHarness.runAnalysis.
 *
 * It is a flat view assembled from the session's inputs and artifacts. The
 * Harness only copies references here — it does not summarize or reformat.
 */
import type { RequirementInput } from '../../tools/index.js';
import type { ChangeExplanation } from '../../skills/changeExplanation/index.js';
import type { RequirementAlignment } from '../../skills/requirementAlignment/index.js';
import type { GapReport } from '../../skills/gapReport/index.js';
import type { FlowArtifact } from '../../skills/flowGeneration/index.js';
import type { PRDescription } from '../../skills/prDescription/index.js';
import type { VideoScript } from '../../skills/videoScript/index.js';
import type { DailyUpdate } from '../../skills/dailyUpdate/index.js';
import type { DailyWorkGuidance } from '../../skills/dailyWorkGuidance/index.js';
import type { TechnicalChangeBrief } from '../../skills/technicalChangeBrief/index.js';
import type { DemoPrepLoop } from '../../skills/demoPrepLoop/index.js';
import type { WeeklyReview } from '../../skills/weeklyReview/index.js';

export interface AnalysisResult {
  sessionId: string;
  requirementInput: RequirementInput;
  changeExplanation: ChangeExplanation;
  requirementAlignment: RequirementAlignment;
  /** Present when the optional flow-generation step ran. */
  flowArtifact?: FlowArtifact;
  /** Present when the optional gap-report step ran. */
  gapReport?: GapReport;
  /** Present when the optional PR-description step ran. */
  prDescription?: PRDescription;
  /** Present when the optional video-script step ran. */
  videoScript?: VideoScript;
  /** Present when the optional daily-update step ran. */
  dailyUpdate?: DailyUpdate;
  /** Present when the optional daily-work-guidance step ran. */
  dailyWorkGuidance?: DailyWorkGuidance;
  /** Present when the optional technical-change-brief step ran. */
  technicalChangeBrief?: TechnicalChangeBrief;
  /** Present when the optional demo-prep-loop step ran. */
  demoPrepLoop?: DemoPrepLoop;
  /** Present when the optional weekly-review step ran. */
  weeklyReview?: WeeklyReview;
}
