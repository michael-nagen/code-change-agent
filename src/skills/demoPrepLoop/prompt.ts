import type { DemoPrepLoopInput } from './types.js';
import {
  UNTRUSTED_CONTENT_SAFETY_INSTRUCTION,
  fenceUntrustedContent,
  renderConnectedSourceContextSection,
} from '../shared/untrustedContent.js';

/**
 * Reasoning constraints encoded in the prompt:
 *  - build an up-to-7-minute demo/video SCRIPT for the ACTUAL change: the story,
 *    walkthrough order, code evidence, and a light screenshot/deck plan kept
 *    secondary — NOT a big presentation/deck generator, NOT a PR description, and
 *    NOT a rehash of the Technical Change Brief
 *  - reason from the raw diff plus the upstream analysis artifacts; never
 *    invent files, screens, UI areas, or line numbers
 *  - mark every path as confirmed vs inferred; omit lineRange unless the exact
 *    lines are visible
 *  - everything stays pending the user's approval — the skill never approves
 *  - optimize for a clear story; slide text stays short, explanations go in
 *    speaker notes and narration
 *  - JSON output matching the DemoPrepLoop schema
 *
 * Grounding: the input carries the raw diff, the requirement/spec, the change
 * explanation, the requirement alignment, and — when available — the gap
 * report, the flow artifact, the daily work guidance, the technical change
 * brief, and the video script.
 */
export function buildPrompt(input: DemoPrepLoopInput): string {
  const changeExplanationJson = JSON.stringify(input.changeExplanation, null, 2);
  const requirementAlignmentJson = JSON.stringify(input.requirementAlignment, null, 2);

  const gapReportSection =
    input.gapReport !== undefined
      ? JSON.stringify(input.gapReport, null, 2)
      : 'Not available — the gap report was not generated for this analysis.';

  const flowArtifactSection =
    input.flowArtifact !== undefined
      ? JSON.stringify(input.flowArtifact, null, 2)
      : 'Not available — the flow artifact was not generated for this analysis.';

  const dailyWorkGuidanceSection =
    input.dailyWorkGuidance !== undefined
      ? JSON.stringify(input.dailyWorkGuidance, null, 2)
      : 'Not available — daily work guidance was not generated for this analysis.';

  const technicalChangeBriefSection =
    input.technicalChangeBrief !== undefined
      ? JSON.stringify(input.technicalChangeBrief, null, 2)
      : 'Not available — the technical change brief was not generated for this analysis.';

  const videoScriptSection =
    input.videoScript !== undefined
      ? JSON.stringify(input.videoScript, null, 2)
      : 'Not available — the video script was not generated for this analysis.';

  const userPreferencesSection =
    input.userPromptPreferences !== undefined && input.userPromptPreferences.trim() !== ''
      ? `\n\n${input.userPromptPreferences}`
      : '';

  const connectedSourceSection = renderConnectedSourceContextSection(input.connectedSourceContext);

  return `You are a demo coach preparing a DEMO PREP LOOP: an UP-TO-7-MINUTE demo/video SCRIPT for a code change. It tells the story of the work and selects the most important technical parts to show — what to say and what to open, in order.

${UNTRUSTED_CONTENT_SAFETY_INSTRUCTION}

WHAT THIS IS:
- A concise, ordered demo/video script (fits within 7 minutes) built around the STORY of the work. Cover, in this order: (1) the general story — what happened, what problem was solved, what was built; (2) schema/storage changes — how the way things are saved changed; (3) new models/types; (4) interesting functionality; (5) meaningful refactors; (6) the 7-minute script order. draftVideoScript is the PRIMARY output; walkthroughOrder is the ordered "what to open and say".
- Technical points are welcome, but only as part of the demo story — not a deep technical brief.

WHAT THIS IS NOT:
- NOT a big presentation/deck generator. Keep deckPlan and screenshotPlan SHORT (only the few visuals that genuinely help the story); do not overproduce slides and do not duplicate the same text across narration and slides.
- NOT the Technical Change Brief. Do NOT restate it or dive into trivial implementation details — reuse its findings only to pick the most interesting things to show and say. (Demo Prep = how to present the work; Technical Brief = how the code is built.)
- NOT a PR description (do not duplicate that artifact).
- NOT a screenshot generator. This plan NEVER captures screenshots; every screenshot is a plan for the user to capture manually.

GROUNDING & HONESTY RULES:
- The RAW DIFF below and the analysis artifacts are the only sources of truth. Do NOT invent files, screens, UI areas, schema changes, or line numbers.
- Use real file paths from the diff/artifacts. For every item with an "evidence" field, set it to "confirmed" when the path/detail is directly visible in the diff/analysis, or "inferred" when it is a reasonable guess you cannot directly see.
- Omit "lineRange" entirely unless the exact lines are visible from the diff; describe the code area instead.
- Every item "status" is exactly "pending_approval"; every slide "status" is exactly "draft"; loopStatus.overallStatus is "pending_user_review"; every checklist "done" is false. Nothing is pre-approved — the user decides.
- Separate confirmed implementation details from suggestions; anything uncertain belongs in whatNeedsUserApproval and approvalQuestions.
- When the TECHNICAL CHANGE BRIEF is available, use it heavily: its schema changes, files worth showing, and talking points should seed the walkthrough order, the code evidence plan, and the slides.
- When DAILY WORK GUIDANCE is available, use it to connect the demo to progress against the spec, what was done, open blockers, and next actions.

STORYTELLING RULES:
- The whole script must fit within 7 minutes. Keep it concise and ordered; every second should earn its place. Focus on what to SAY and SHOW, using the most interesting product/technical proof points.
- Order the walkthrough for narrative impact (problem, then solution, then proof), not dependency order. A good default: the general story, then schema/storage changes, then new models/types, then the most interesting functionality, then meaningful refactors, then the proof moment.
- Optimize for a clear demo story, not maximum technical detail; use whatToSkip to cut trivial implementation details and keep the script tight.
- Keep the deck LIGHT: only include a slide when a visual genuinely helps. onSlideText is SHORT and visual (at most 4 bullets of ~6 words each); put explanation in narration and do NOT repeat the same wording across narrationScript, speakerNotes, and onSlideText.
- Prefer slides that use screenshots from the screenshot plan; reference them by their "id" in screenshotIds. Every referenced id must exist in screenshotPlan.
- draftVideoScript is the primary deliverable: its sections should carry the 7-minute story end to end. The finalShortPitch takes 30-45 seconds to say out loud, usable as the video opening, a Slack update, or a project submission pitch.
- The readiness checklist covers preparation before recording/presenting: run tests, run typecheck, open the app, prepare input, generate artifacts, capture any planned screenshots, rehearse the script, verify the copy/output flow, and have the important files ready to show.

Return ONLY a valid JSON object — no markdown fences, no commentary — with this exact shape:

{
  "loopStatus": {
    "currentStage": "Where the demo prep loop stands (e.g. initial plan proposed).",
    "overallStatus": "pending_user_review",
    "nextRecommendedAction": "What the user should do next.",
    "whatNeedsUserApproval": ["A specific decision waiting on the user."]
  },
  "demoStoryProposal": {
    "problem": "The problem the change addresses.",
    "solution": "The solution, in story terms.",
    "technicalChange": "What technically changed, in one or two sentences.",
    "userOrProductValue": "Why it matters to the user/product.",
    "proofOrDemoMoment": "The moment that proves it works — the demo highlight.",
    "limitationsOrNextSteps": "Honest limitations or next steps.",
    "status": "pending_approval"
  },
  "walkthroughOrder": [
    { "order": 1, "title": "...", "filePath": "real path (omit if this step is an area)", "areaName": "UI/conceptual area (omit if this step is a file)", "type": "code | ui | output | test | diagram | summary", "whyThisComesHere": "...", "whatToShow": "...", "whatToSay": "...", "whatToSkip": "...", "relatedFeatureOrConcept": "...", "estimatedTimeSeconds": 45, "mustShow": true, "evidence": "confirmed | inferred", "status": "pending_approval" }
  ],
  "codeEvidencePlan": [
    { "filePath": "real path (omit if this is an area)", "areaName": "area (omit if this is a file)", "evidenceType": "schema | model | parser | prompt | workflow | ui | copy | test | safety | integration | other", "whatItProves": "...", "whyItMatters": "...", "confidence": "high | medium | low", "evidence": "confirmed | inferred", "status": "pending_approval" }
  ],
  "screenshotPlan": [
    { "id": "shot-1", "title": "...", "type": "code | ui | output | diagram | summary", "filePath": "real path for code screenshots (omit otherwise)", "codeArea": "the code area to frame (omit if not needed)", "lineRange": "only if visible from the diff (omit otherwise)", "uiArea": "the UI area to frame (omit otherwise)", "whatToCapture": "...", "whyThisMatters": "...", "whatToSay": "...", "whatToSkip": "...", "relatedFeatureOrConcept": "...", "estimatedTimeSeconds": 30, "mustShow": true, "suggestedCaption": "...", "evidence": "confirmed | inferred", "status": "pending_approval" }
  ],
  "approvalQuestions": [
    { "question": "...", "whyItMatters": "...", "options": ["...", "..."], "recommendedOption": "one of the options (omit if no recommendation)", "status": "pending_approval" }
  ],
  "deckPlan": [
    { "slideNumber": 1, "title": "...", "purpose": "...", "visualType": "code_screenshot | ui_screenshot | output_screenshot | diagram | bullets | summary", "screenshotIds": ["shot-1"], "whatToShow": "What visually appears on the slide.", "onSlideText": ["Short bullet", "Another short bullet"], "speakerNotes": "What the presenter explains while the slide is shown.", "narrationScript": "A polished version of what to say if recording a video.", "transitionToNextSlide": "One sentence connecting to the next slide.", "estimatedTimeSeconds": 40, "mustHave": true, "status": "draft" }
  ],
  "draftVideoScript": {
    "title": "...",
    "estimatedDuration": "up to 7 minutes",
    "sections": [
      { "kind": "opening | context_problem | implementation_walkthrough | demo_output | tradeoffs_limitations | closing", "title": "...", "narration": "...", "visualCue": "...", "estimatedTimeSeconds": 60 }
    ]
  },
  "finalShortPitch": "A 30-45 second spoken pitch for the feature.",
  "readinessChecklist": [
    { "item": "...", "why": "...", "done": false }
  ]
}

Keep the tone clear, practical, and demo-focused — the author should be able to record a tight sub-7-minute demo from this script without improvising, and without building a big deck.${userPreferencesSection}

${fenceUntrustedContent({ label: 'REQUIREMENT / SPEC', content: input.requirementText })}

${fenceUntrustedContent({ label: 'RAW DIFF', content: input.rawDiff })}

CHANGE EXPLANATION:
${changeExplanationJson}

REQUIREMENT ALIGNMENT:
${requirementAlignmentJson}

GAP REPORT:
${gapReportSection}

FLOW ARTIFACT:
${flowArtifactSection}

DAILY WORK GUIDANCE:
${dailyWorkGuidanceSection}

TECHNICAL CHANGE BRIEF (use this heavily when available):
${technicalChangeBriefSection}

VIDEO SCRIPT:
${videoScriptSection}${connectedSourceSection}`;
}
