/**
 * Types for the DemoPrepLoopSkill — a demo/presentation planning artifact.
 *
 * The Demo Prep Loop plans how to demo or present a code change end-to-end:
 * the story to tell, the best order to open files/areas, the code evidence that
 * proves the implementation, a manual screenshot plan, a slide-by-slide deck
 * plan that separates what is SHOWN from what is SAID, a 5–7 minute video
 * script, a 30–45 second pitch, and a readiness checklist.
 *
 * It is a loop-style planning artifact, not a final one-shot answer: every
 * proposed item stays pending the user's approval, and open decisions surface
 * as explicit approval questions.
 *
 * Like the Technical Change Brief, this skill DOES receive the raw diff: the
 * walkthrough order and screenshot plan point at real files, so it reasons from
 * the diff plus the upstream analysis artifacts. Optional artifacts (gap
 * report, flow, daily work guidance, technical change brief, video script) are
 * consumed only when they are available on the session.
 *
 * The deck plan is deliberately structured so the deterministic presentation
 * builder tool (src/tools/presentation) can turn it into a Markdown deck
 * without any further LLM involvement.
 */
import type { ChangeExplanation } from '../changeExplanation/index.js';
import type { RequirementAlignment } from '../requirementAlignment/index.js';
import type { GapReport } from '../gapReport/index.js';
import type { FlowArtifact } from '../flowGeneration/index.js';
import type { DailyWorkGuidance } from '../dailyWorkGuidance/index.js';
import type { TechnicalChangeBrief } from '../technicalChangeBrief/index.js';
import type { VideoScript } from '../videoScript/index.js';

export interface DemoPrepLoopInput {
  /** The raw diff (PR diff / commit diff) the demo is about. */
  rawDiff: string;
  /** The requirement or spec the change was built against. */
  requirementText: string;
  changeExplanation: ChangeExplanation;
  requirementAlignment: RequirementAlignment;
  /** Present only when the optional gap-report step ran. */
  gapReport?: GapReport;
  /** Present only when the optional flow-generation step ran. */
  flowArtifact?: FlowArtifact;
  /** Present only when the optional daily-work-guidance step ran. */
  dailyWorkGuidance?: DailyWorkGuidance;
  /** Present only when the optional technical-change-brief step ran; used heavily. */
  technicalChangeBrief?: TechnicalChangeBrief;
  /** Present only when the optional video-script step ran. */
  videoScript?: VideoScript;
}

/**
 * How strongly a file path or area is supported by the diff/analysis.
 * - confirmed — directly visible in the provided diff or analysis artifacts.
 * - inferred  — a reasonable guess, clearly flagged as such.
 */
export type PathEvidence = 'confirmed' | 'inferred';

/** Every proposed item awaits the user's decision; the skill never emits approvals. */
export type DemoApprovalStatus = 'pending_approval';

/** Slides start as drafts; approval happens outside the skill. */
export type SlideStatus = 'draft';

/** The loop-level status; the skill always emits 'pending_user_review'. */
export type OverallLoopStatus = 'pending_user_review' | 'approved' | 'needs_revision';

/** Section 1 — where the demo prep loop stands and what needs the user. */
export interface LoopStatus {
  /** The stage the loop is at (e.g. "initial plan proposed"). */
  currentStage: string;
  overallStatus: OverallLoopStatus;
  /** What the user should do next. */
  nextRecommendedAction: string;
  /** The specific decisions waiting on the user. */
  whatNeedsUserApproval: string[];
}

/** Section 2 — the core narrative of the presentation. */
export interface DemoStoryProposal {
  problem: string;
  solution: string;
  technicalChange: string;
  userOrProductValue: string;
  /** The moment that proves it works — the demo highlight. */
  proofOrDemoMoment: string;
  limitationsOrNextSteps: string;
  status: DemoApprovalStatus;
}

/** What kind of thing a walkthrough step shows. */
export type WalkthroughStepType = 'code' | 'ui' | 'output' | 'test' | 'diagram' | 'summary';

/**
 * Section 3 — one step of the recommended walkthrough order. Ordered for
 * storytelling (problem → solution → proof), not dependency order. At least one
 * of filePath/areaName is always present (parser-enforced).
 */
export interface WalkthroughStep {
  order: number;
  title: string;
  /** Real file path from the diff/analysis, when this step shows code. */
  filePath?: string;
  /** UI/conceptual area name, when this step is not a single file. */
  areaName?: string;
  type: WalkthroughStepType;
  whyThisComesHere: string;
  whatToShow: string;
  whatToSay: string;
  whatToSkip: string;
  relatedFeatureOrConcept: string;
  estimatedTimeSeconds: number;
  mustShow: boolean;
  evidence: PathEvidence;
  status: DemoApprovalStatus;
}

/** What kind of implementation evidence a code item provides. */
export type CodeEvidenceType =
  | 'schema'
  | 'model'
  | 'parser'
  | 'prompt'
  | 'workflow'
  | 'ui'
  | 'copy'
  | 'test'
  | 'safety'
  | 'integration'
  | 'other';

/** How confident the plan is that this evidence carries the point. */
export type EvidenceConfidence = 'high' | 'medium' | 'low';

/** Section 4 — a piece of code evidence that proves the implementation. */
export interface CodeEvidenceItem {
  /** Real file path from the diff/analysis, when the evidence is a file. */
  filePath?: string;
  /** UI/conceptual area name, when the evidence is not a single file. */
  areaName?: string;
  evidenceType: CodeEvidenceType;
  whatItProves: string;
  whyItMatters: string;
  confidence: EvidenceConfidence;
  evidence: PathEvidence;
  status: DemoApprovalStatus;
}

/** What kind of screenshot to capture. */
export type ScreenshotType = 'code' | 'ui' | 'output' | 'diagram' | 'summary';

/**
 * Section 5 — a screenshot the user will capture MANUALLY. The skill never
 * captures screenshots; it plans them so the deck can reference them by id.
 */
export interface ScreenshotPlanItem {
  /** Stable reference id (e.g. "shot-1") used by deck slides. */
  id: string;
  title: string;
  type: ScreenshotType;
  /** Real file path, when this is a code screenshot. */
  filePath?: string;
  /** The code area to frame, when a file is too broad. */
  codeArea?: string;
  /** Only when the exact lines are visible from the diff/analysis — never invented. */
  lineRange?: string;
  /** The UI area to frame, when this is a UI screenshot. */
  uiArea?: string;
  whatToCapture: string;
  whyThisMatters: string;
  whatToSay: string;
  whatToSkip: string;
  relatedFeatureOrConcept: string;
  estimatedTimeSeconds: number;
  mustShow: boolean;
  suggestedCaption: string;
  evidence: PathEvidence;
  status: DemoApprovalStatus;
}

/** Section 6 — a decision the user should make before finalizing the demo. */
export interface ApprovalQuestion {
  question: string;
  whyItMatters: string;
  options: string[];
  recommendedOption?: string;
  status: DemoApprovalStatus;
}

/** What visually carries a slide. */
export type SlideVisualType =
  | 'code_screenshot'
  | 'ui_screenshot'
  | 'output_screenshot'
  | 'diagram'
  | 'bullets'
  | 'summary';

/**
 * Section 7 — one slide of the presentation deck plan. Separates what appears
 * ON the slide (onSlideText — short bullets) from what the presenter SAYS
 * (speakerNotes for live delivery, narrationScript for a recorded video).
 */
export interface DeckSlide {
  slideNumber: number;
  title: string;
  purpose: string;
  visualType: SlideVisualType;
  /** ScreenshotPlanItem ids this slide shows; every id is parser-validated. */
  screenshotIds?: string[];
  whatToShow: string;
  /** Short bullets that appear on the slide — keep them visual, not prose. */
  onSlideText: string[];
  speakerNotes: string;
  narrationScript: string;
  /** One sentence connecting this slide to the next. */
  transitionToNextSlide: string;
  estimatedTimeSeconds: number;
  mustHave: boolean;
  status: SlideStatus;
}

/** The six parts of the draft video script. */
export type VideoScriptSectionKind =
  | 'opening'
  | 'context_problem'
  | 'implementation_walkthrough'
  | 'demo_output'
  | 'tradeoffs_limitations'
  | 'closing';

/** Section 8 — one part of the draft 5–7 minute video script. */
export interface DraftVideoScriptSection {
  kind: VideoScriptSectionKind;
  title: string;
  narration: string;
  visualCue: string;
  estimatedTimeSeconds: number;
}

/** Section 8 — the draft video script, derived from the deck plan and walkthrough order. */
export interface DraftVideoScript {
  title: string;
  /** e.g. "5–7 minutes". */
  estimatedDuration: string;
  sections: DraftVideoScriptSection[];
}

/** Section 10 — a manual prep task; `done` is always false from the skill. */
export interface ReadinessChecklistItem {
  item: string;
  why: string;
  done: boolean;
}

/**
 * The Demo Prep Loop artifact: a structured, approval-gated plan for demoing
 * and presenting a code change, section by section.
 */
export interface DemoPrepLoop {
  /** Section 1 — loop status and what awaits the user. */
  loopStatus: LoopStatus;
  /** Section 2 — the demo story: problem, solution, value, proof. */
  demoStoryProposal: DemoStoryProposal;
  /** Section 3 — the best order to open files/areas, story-first. */
  walkthroughOrder: WalkthroughStep[];
  /** Section 4 — the code evidence that proves the implementation. */
  codeEvidencePlan: CodeEvidenceItem[];
  /** Section 5 — screenshots to capture manually, referenced by the deck. */
  screenshotPlan: ScreenshotPlanItem[];
  /** Section 6 — decisions the user should make before finalizing. */
  approvalQuestions: ApprovalQuestion[];
  /** Section 7 — slide-by-slide deck plan separating shown from said. */
  deckPlan: DeckSlide[];
  /** Section 8 — draft 5–7 minute video script. */
  draftVideoScript: DraftVideoScript;
  /** Section 9 — a 30–45 second pitch usable as an opening or update. */
  finalShortPitch: string;
  /** Section 10 — checklist before recording/presenting. */
  readinessChecklist: ReadinessChecklistItem[];
}
