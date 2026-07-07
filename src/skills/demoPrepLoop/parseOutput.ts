import { SkillError } from '../../errors/SkillError.js';
import type {
  ApprovalQuestion,
  CodeEvidenceItem,
  CodeEvidenceType,
  DeckSlide,
  DemoApprovalStatus,
  DemoPrepLoop,
  DemoStoryProposal,
  DraftVideoScript,
  DraftVideoScriptSection,
  EvidenceConfidence,
  LoopStatus,
  OverallLoopStatus,
  PathEvidence,
  ReadinessChecklistItem,
  ScreenshotPlanItem,
  ScreenshotType,
  SlideStatus,
  SlideVisualType,
  VideoScriptSectionKind,
  WalkthroughStep,
  WalkthroughStepType,
} from './types.js';

const VALID_OVERALL_STATUS: readonly OverallLoopStatus[] = [
  'pending_user_review',
  'approved',
  'needs_revision',
];

const VALID_APPROVAL_STATUS: readonly DemoApprovalStatus[] = ['pending_approval'];

const VALID_SLIDE_STATUS: readonly SlideStatus[] = ['draft'];

const VALID_PATH_EVIDENCE: readonly PathEvidence[] = ['confirmed', 'inferred'];

const VALID_WALKTHROUGH_TYPES: readonly WalkthroughStepType[] = [
  'code',
  'ui',
  'output',
  'test',
  'diagram',
  'summary',
];

const VALID_EVIDENCE_TYPES: readonly CodeEvidenceType[] = [
  'schema',
  'model',
  'parser',
  'prompt',
  'workflow',
  'ui',
  'copy',
  'test',
  'safety',
  'integration',
  'other',
];

const VALID_CONFIDENCE: readonly EvidenceConfidence[] = ['high', 'medium', 'low'];

const VALID_SCREENSHOT_TYPES: readonly ScreenshotType[] = [
  'code',
  'ui',
  'output',
  'diagram',
  'summary',
];

const VALID_SLIDE_VISUAL_TYPES: readonly SlideVisualType[] = [
  'code_screenshot',
  'ui_screenshot',
  'output_screenshot',
  'diagram',
  'bullets',
  'summary',
];

const VALID_VIDEO_SECTION_KINDS: readonly VideoScriptSectionKind[] = [
  'opening',
  'context_problem',
  'implementation_walkthrough',
  'demo_output',
  'tradeoffs_limitations',
  'closing',
];

/**
 * Tolerates JSON wrapped in markdown code fences in case the model adds them
 * despite instructions not to.
 *
 * Throws SkillError('INVALID_OUTPUT') if the output cannot be parsed or fails
 * structural validation. Never returns partial data.
 */
export function parseOutput(text: string): DemoPrepLoop {
  const json = extractJson(text);

  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new SkillError(
      'INVALID_OUTPUT',
      `Model output is not valid JSON. First 200 chars: ${json.slice(0, 200)}`,
    );
  }

  return validate(raw);
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch !== null) {
    const inner = fenceMatch[1];
    if (inner !== undefined) {
      return inner;
    }
  }
  return trimmed;
}

function validate(raw: unknown): DemoPrepLoop {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new SkillError('INVALID_OUTPUT', 'Model output must be a JSON object.');
  }

  const obj = raw as Record<string, unknown>;

  const screenshotPlan = requireScreenshotPlan({ obj, key: 'screenshotPlan' });
  const deckPlan = requireDeckPlan({ obj, key: 'deckPlan' });
  assertDeckScreenshotRefs({ deckPlan, screenshotPlan });

  return {
    loopStatus: requireLoopStatus({ obj, key: 'loopStatus' }),
    demoStoryProposal: requireDemoStoryProposal({ obj, key: 'demoStoryProposal' }),
    walkthroughOrder: requireWalkthroughSteps({ obj, key: 'walkthroughOrder' }),
    codeEvidencePlan: requireCodeEvidencePlan({ obj, key: 'codeEvidencePlan' }),
    screenshotPlan,
    approvalQuestions: requireApprovalQuestions({ obj, key: 'approvalQuestions' }),
    deckPlan,
    draftVideoScript: requireDraftVideoScript({ obj, key: 'draftVideoScript' }),
    finalShortPitch: requireString({ obj, key: 'finalShortPitch' }),
    readinessChecklist: requireReadinessChecklist({ obj, key: 'readinessChecklist' }),
  };
}

/** Every deck slide screenshot reference must point at a planned screenshot. */
function assertDeckScreenshotRefs({
  deckPlan,
  screenshotPlan,
}: {
  deckPlan: DeckSlide[];
  screenshotPlan: ScreenshotPlanItem[];
}): void {
  const knownIds = new Set(screenshotPlan.map((shot) => shot.id));
  for (const slide of deckPlan) {
    for (const id of slide.screenshotIds ?? []) {
      if (!knownIds.has(id)) {
        throw new SkillError(
          'INVALID_OUTPUT',
          `deckPlan slide ${slide.slideNumber} references unknown screenshot id "${id}".`,
        );
      }
    }
  }
}

function requireLoopStatus({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): LoopStatus {
  const entry = requireObject({ obj, key });
  return {
    currentStage: requireNestedString({ entry, key, field: 'currentStage' }),
    overallStatus: requireNestedEnum({
      entry,
      key,
      field: 'overallStatus',
      valid: VALID_OVERALL_STATUS,
    }),
    nextRecommendedAction: requireNestedString({ entry, key, field: 'nextRecommendedAction' }),
    whatNeedsUserApproval: requireNestedStringArray({ entry, key, field: 'whatNeedsUserApproval' }),
  };
}

function requireDemoStoryProposal({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): DemoStoryProposal {
  const entry = requireObject({ obj, key });
  return {
    problem: requireNestedString({ entry, key, field: 'problem' }),
    solution: requireNestedString({ entry, key, field: 'solution' }),
    technicalChange: requireNestedString({ entry, key, field: 'technicalChange' }),
    userOrProductValue: requireNestedString({ entry, key, field: 'userOrProductValue' }),
    proofOrDemoMoment: requireNestedString({ entry, key, field: 'proofOrDemoMoment' }),
    limitationsOrNextSteps: requireNestedString({ entry, key, field: 'limitationsOrNextSteps' }),
    status: requireNestedEnum({ entry, key, field: 'status', valid: VALID_APPROVAL_STATUS }),
  };
}

function requireWalkthroughSteps({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): WalkthroughStep[] {
  return requireObjectArray({ obj, key }).map((entry) => {
    const location = requireLocation({ entry, key });
    const step: WalkthroughStep = {
      order: requireNestedNumber({ entry, key, field: 'order' }),
      title: requireNestedString({ entry, key, field: 'title' }),
      type: requireNestedEnum({ entry, key, field: 'type', valid: VALID_WALKTHROUGH_TYPES }),
      whyThisComesHere: requireNestedString({ entry, key, field: 'whyThisComesHere' }),
      whatToShow: requireNestedString({ entry, key, field: 'whatToShow' }),
      whatToSay: requireNestedString({ entry, key, field: 'whatToSay' }),
      whatToSkip: requireNestedString({ entry, key, field: 'whatToSkip' }),
      relatedFeatureOrConcept: requireNestedString({
        entry,
        key,
        field: 'relatedFeatureOrConcept',
      }),
      estimatedTimeSeconds: requireNestedNumber({ entry, key, field: 'estimatedTimeSeconds' }),
      mustShow: requireNestedBoolean({ entry, key, field: 'mustShow' }),
      evidence: requireNestedEnum({ entry, key, field: 'evidence', valid: VALID_PATH_EVIDENCE }),
      status: requireNestedEnum({ entry, key, field: 'status', valid: VALID_APPROVAL_STATUS }),
      ...location,
    };
    return step;
  });
}

function requireCodeEvidencePlan({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): CodeEvidenceItem[] {
  return requireObjectArray({ obj, key }).map((entry) => {
    const location = requireLocation({ entry, key });
    const item: CodeEvidenceItem = {
      evidenceType: requireNestedEnum({
        entry,
        key,
        field: 'evidenceType',
        valid: VALID_EVIDENCE_TYPES,
      }),
      whatItProves: requireNestedString({ entry, key, field: 'whatItProves' }),
      whyItMatters: requireNestedString({ entry, key, field: 'whyItMatters' }),
      confidence: requireNestedEnum({ entry, key, field: 'confidence', valid: VALID_CONFIDENCE }),
      evidence: requireNestedEnum({ entry, key, field: 'evidence', valid: VALID_PATH_EVIDENCE }),
      status: requireNestedEnum({ entry, key, field: 'status', valid: VALID_APPROVAL_STATUS }),
      ...location,
    };
    return item;
  });
}

function requireScreenshotPlan({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): ScreenshotPlanItem[] {
  return requireObjectArray({ obj, key }).map((entry) => {
    const filePath = optionalNestedString({ entry, key, field: 'filePath' });
    const codeArea = optionalNestedString({ entry, key, field: 'codeArea' });
    const lineRange = optionalNestedString({ entry, key, field: 'lineRange' });
    const uiArea = optionalNestedString({ entry, key, field: 'uiArea' });
    const item: ScreenshotPlanItem = {
      id: requireNestedString({ entry, key, field: 'id' }),
      title: requireNestedString({ entry, key, field: 'title' }),
      type: requireNestedEnum({ entry, key, field: 'type', valid: VALID_SCREENSHOT_TYPES }),
      whatToCapture: requireNestedString({ entry, key, field: 'whatToCapture' }),
      whyThisMatters: requireNestedString({ entry, key, field: 'whyThisMatters' }),
      whatToSay: requireNestedString({ entry, key, field: 'whatToSay' }),
      whatToSkip: requireNestedString({ entry, key, field: 'whatToSkip' }),
      relatedFeatureOrConcept: requireNestedString({
        entry,
        key,
        field: 'relatedFeatureOrConcept',
      }),
      estimatedTimeSeconds: requireNestedNumber({ entry, key, field: 'estimatedTimeSeconds' }),
      mustShow: requireNestedBoolean({ entry, key, field: 'mustShow' }),
      suggestedCaption: requireNestedString({ entry, key, field: 'suggestedCaption' }),
      evidence: requireNestedEnum({ entry, key, field: 'evidence', valid: VALID_PATH_EVIDENCE }),
      status: requireNestedEnum({ entry, key, field: 'status', valid: VALID_APPROVAL_STATUS }),
      ...(filePath !== undefined ? { filePath } : {}),
      ...(codeArea !== undefined ? { codeArea } : {}),
      ...(lineRange !== undefined ? { lineRange } : {}),
      ...(uiArea !== undefined ? { uiArea } : {}),
    };
    return item;
  });
}

function requireApprovalQuestions({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): ApprovalQuestion[] {
  return requireObjectArray({ obj, key }).map((entry) => {
    const recommendedOption = optionalNestedString({ entry, key, field: 'recommendedOption' });
    const question: ApprovalQuestion = {
      question: requireNestedString({ entry, key, field: 'question' }),
      whyItMatters: requireNestedString({ entry, key, field: 'whyItMatters' }),
      options: requireNestedStringArray({ entry, key, field: 'options' }),
      status: requireNestedEnum({ entry, key, field: 'status', valid: VALID_APPROVAL_STATUS }),
      ...(recommendedOption !== undefined ? { recommendedOption } : {}),
    };
    return question;
  });
}

function requireDeckPlan({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): DeckSlide[] {
  return requireObjectArray({ obj, key }).map((entry) => {
    const screenshotIds = optionalNestedStringArray({ entry, key, field: 'screenshotIds' });
    const slide: DeckSlide = {
      slideNumber: requireNestedNumber({ entry, key, field: 'slideNumber' }),
      title: requireNestedString({ entry, key, field: 'title' }),
      purpose: requireNestedString({ entry, key, field: 'purpose' }),
      visualType: requireNestedEnum({
        entry,
        key,
        field: 'visualType',
        valid: VALID_SLIDE_VISUAL_TYPES,
      }),
      whatToShow: requireNestedString({ entry, key, field: 'whatToShow' }),
      onSlideText: requireNestedStringArray({ entry, key, field: 'onSlideText' }),
      speakerNotes: requireNestedString({ entry, key, field: 'speakerNotes' }),
      narrationScript: requireNestedString({ entry, key, field: 'narrationScript' }),
      transitionToNextSlide: requireNestedString({ entry, key, field: 'transitionToNextSlide' }),
      estimatedTimeSeconds: requireNestedNumber({ entry, key, field: 'estimatedTimeSeconds' }),
      mustHave: requireNestedBoolean({ entry, key, field: 'mustHave' }),
      status: requireNestedEnum({ entry, key, field: 'status', valid: VALID_SLIDE_STATUS }),
      ...(screenshotIds !== undefined ? { screenshotIds } : {}),
    };
    return slide;
  });
}

function requireDraftVideoScript({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): DraftVideoScript {
  const entry = requireObject({ obj, key });
  const sections: DraftVideoScriptSection[] = requireNestedObjectArray({
    entry,
    key,
    field: 'sections',
  }).map((section) => ({
    kind: requireNestedEnum({
      entry: section,
      key: `${key}.sections`,
      field: 'kind',
      valid: VALID_VIDEO_SECTION_KINDS,
    }),
    title: requireNestedString({ entry: section, key: `${key}.sections`, field: 'title' }),
    narration: requireNestedString({ entry: section, key: `${key}.sections`, field: 'narration' }),
    visualCue: requireNestedString({ entry: section, key: `${key}.sections`, field: 'visualCue' }),
    estimatedTimeSeconds: requireNestedNumber({
      entry: section,
      key: `${key}.sections`,
      field: 'estimatedTimeSeconds',
    }),
  }));
  if (sections.length === 0) {
    throw new SkillError('INVALID_OUTPUT', `${key}.sections must not be empty.`);
  }
  return {
    title: requireNestedString({ entry, key, field: 'title' }),
    estimatedDuration: requireNestedString({ entry, key, field: 'estimatedDuration' }),
    sections,
  };
}

function requireReadinessChecklist({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): ReadinessChecklistItem[] {
  return requireObjectArray({ obj, key }).map((entry) => ({
    item: requireNestedString({ entry, key, field: 'item' }),
    why: requireNestedString({ entry, key, field: 'why' }),
    done: requireNestedBoolean({ entry, key, field: 'done' }),
  }));
}

/** At least one of filePath/areaName must locate the item. */
function requireLocation({
  entry,
  key,
}: {
  entry: Record<string, unknown>;
  key: string;
}): { filePath?: string; areaName?: string } {
  const filePath = optionalNestedString({ entry, key, field: 'filePath' });
  const areaName = optionalNestedString({ entry, key, field: 'areaName' });
  if (filePath === undefined && areaName === undefined) {
    throw new SkillError(
      'INVALID_OUTPUT',
      `Items in "${key}" must have at least one of "filePath" or "areaName".`,
    );
  }
  return {
    ...(filePath !== undefined ? { filePath } : {}),
    ...(areaName !== undefined ? { areaName } : {}),
  };
}

function requireString({ obj, key }: { obj: Record<string, unknown>; key: string }): string {
  const val = obj[key];
  if (typeof val !== 'string' || val.trim() === '') {
    throw new SkillError('INVALID_OUTPUT', `Missing or empty string field: "${key}".`);
  }
  return val;
}

function requireObject({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): Record<string, unknown> {
  const val = obj[key];
  if (typeof val !== 'object' || val === null || Array.isArray(val)) {
    throw new SkillError('INVALID_OUTPUT', `Field "${key}" must be an object.`);
  }
  return val as Record<string, unknown>;
}

function requireObjectArray({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): Record<string, unknown>[] {
  const val = obj[key];
  if (!Array.isArray(val)) {
    throw new SkillError('INVALID_OUTPUT', `Field "${key}" must be an array.`);
  }
  const result: Record<string, unknown>[] = [];
  for (const item of val) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new SkillError('INVALID_OUTPUT', `All items in "${key}" must be objects.`);
    }
    result.push(item as Record<string, unknown>);
  }
  return result;
}

function requireNestedObjectArray({
  entry,
  key,
  field,
}: {
  entry: Record<string, unknown>;
  key: string;
  field: string;
}): Record<string, unknown>[] {
  const val = entry[field];
  if (!Array.isArray(val)) {
    throw new SkillError('INVALID_OUTPUT', `${key}.${field} must be an array.`);
  }
  const result: Record<string, unknown>[] = [];
  for (const item of val) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new SkillError('INVALID_OUTPUT', `All items in ${key}.${field} must be objects.`);
    }
    result.push(item as Record<string, unknown>);
  }
  return result;
}

function requireNestedString({
  entry,
  key,
  field,
}: {
  entry: Record<string, unknown>;
  key: string;
  field: string;
}): string {
  const val = entry[field];
  if (typeof val !== 'string' || val.trim() === '') {
    throw new SkillError('INVALID_OUTPUT', `${key}.${field} must be a non-empty string.`);
  }
  return val;
}

function optionalNestedString({
  entry,
  key,
  field,
}: {
  entry: Record<string, unknown>;
  key: string;
  field: string;
}): string | undefined {
  const val = entry[field];
  if (val === undefined || val === null || val === '') {
    return undefined;
  }
  if (typeof val !== 'string' || val.trim() === '') {
    throw new SkillError(
      'INVALID_OUTPUT',
      `${key}.${field} must be a non-empty string when present.`,
    );
  }
  return val;
}

function requireNestedStringArray({
  entry,
  key,
  field,
}: {
  entry: Record<string, unknown>;
  key: string;
  field: string;
}): string[] {
  const val = entry[field];
  if (!Array.isArray(val)) {
    throw new SkillError('INVALID_OUTPUT', `${key}.${field} must be an array.`);
  }
  const result: string[] = [];
  for (const item of val) {
    if (typeof item !== 'string') {
      throw new SkillError('INVALID_OUTPUT', `All items in ${key}.${field} must be strings.`);
    }
    result.push(item);
  }
  return result;
}

function optionalNestedStringArray({
  entry,
  key,
  field,
}: {
  entry: Record<string, unknown>;
  key: string;
  field: string;
}): string[] | undefined {
  if (entry[field] === undefined || entry[field] === null) {
    return undefined;
  }
  return requireNestedStringArray({ entry, key, field });
}

function requireNestedBoolean({
  entry,
  key,
  field,
}: {
  entry: Record<string, unknown>;
  key: string;
  field: string;
}): boolean {
  const val = entry[field];
  if (typeof val !== 'boolean') {
    throw new SkillError('INVALID_OUTPUT', `${key}.${field} must be a boolean.`);
  }
  return val;
}

function requireNestedNumber({
  entry,
  key,
  field,
}: {
  entry: Record<string, unknown>;
  key: string;
  field: string;
}): number {
  const val = entry[field];
  if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) {
    throw new SkillError(
      'INVALID_OUTPUT',
      `${key}.${field} must be a non-negative number. Got: ${String(val)}.`,
    );
  }
  return val;
}

function requireNestedEnum<T extends string>({
  entry,
  key,
  field,
  valid,
}: {
  entry: Record<string, unknown>;
  key: string;
  field: string;
  valid: readonly T[];
}): T {
  const val = entry[field];
  if (typeof val !== 'string' || !(valid as readonly string[]).includes(val)) {
    throw new SkillError(
      'INVALID_OUTPUT',
      `${key}.${field} must be one of: ${valid.join(', ')}. Got: ${String(val)}.`,
    );
  }
  return val as T;
}
