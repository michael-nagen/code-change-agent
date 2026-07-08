# UI Functionality Spec for Claude Design

> Purpose: this document describes **exactly what the new UI must support functionally**, so a redesigned interface can later be connected to the existing backend logic without changing behavior. It is derived from the current running app (server routes, client controllers, artifact types, and copy/download formatters). It is **functional/contract** guidance, not visual direction — Claude Design owns the look and feel.
>
> Do not change the data contract when redesigning. Every field, action, and state below already exists (or is explicitly marked future-ready).

---

## 1. Product framing

**Developer Work Companion** — a code-focused companion that helps a developer understand a code change, track progress against a spec, generate daily/weekly updates, prepare demos and presentations, and carry project memory across sessions.

The core principle is **analyze once, then work from the analysis**: the user runs one initial analysis, and every other output (daily guidance, technical brief, demo prep, weekly review, PR draft, etc.) is generated **on demand** from that same session — never recomputed from scratch. Generated text/plans are copyable and, for the demo deck, downloadable.

---

## 2. Main user flow

The ideal progression is **input → analysis → guidance → review → presentation → memory**:

1. **Enter inputs**: project name (optional), a requirement/spec, and a code diff. The requirement/diff can come from one of four source modes (manual, GitHub URL, website URL, pasted Notion text).
2. **Run Initial Analysis**. This runs only the **base understanding** artifacts.
3. **App shows the base analysis** in a workspace (What Changed, Requirement Check, PR Readiness, Feature Flow) plus an Overview.
4. **Generate on-demand artifacts** individually, whenever ready:
   - Daily Work Guidance
   - Technical Change Brief
   - Demo Prep Loop (+ deck downloads)
   - Weekly Review
   - (also present today: PR Draft, Walkthrough Script, Daily Prep)
5. **Save memory updates** from Daily Work Guidance or Weekly Review (explicit, user-confirmed).
6. **View / edit / clear project memory** in the Project Memory panel.
7. **Copy** any update, prompt, talking points, or plan section.
8. **Download** the presentation deck (Markdown and PPTX).

Generation is **incremental**: it reuses the existing session and only runs the newly requested skill, so switching between artifacts is cheap and already-generated artifacts persist.

---

## 3. Required screens / layout areas

The current app is a **single page** with a top input region and a master/detail workspace that appears after analysis. The redesign should preserve these functional areas (visual arrangement is free):

- **App shell** — product header + an honest **mode banner** (real vs. mock/demo).
- **Left project / context panel (input area)**:
  - a **Project** card (project name),
  - a **Source & requirement** card (source-mode selector + the mode-specific input fields + the Run Initial Analysis button).
- **Status area** — a live status line (idle / loading / success / error) and a "Show debug data" toggle.
- **Main analysis workspace** (appears after analysis) laid out as **master / detail**:
  - **Left navigation** — Overview, Project Memory, a "Base analysis" group, a "Generated outputs" group, and (when debug is on) Raw JSON. Each artifact nav item shows a **status chip**.
  - **Main content panel** — shows exactly one selected item at a time (document-viewer style), with a header (title + description), an **actions row** (copy/download/save), and the rendered artifact body.
  - **Side chat panel** — for editing editable text artifacts (see §5).
- **Artifact cards area** — the base + generated artifacts, each selectable from the nav and rendered in the main panel.
- **Actions panel** — per-artifact actions live in the panel header (copy buttons, download buttons, Save to memory, Generate/Try again).
- **Memory / Project Status panel** — "Project Memory" view: saved snapshot, checklist statuses, decisions, blockers, next actions, personal preferences, with Edit / Save / Cancel / Clear.
- **Source status area** — today this is the source-mode selector + per-mode helper notes and the mode banner. (A richer "connected sources" status is future-ready; see §10.)
- **Presentation / deck area** — part of the Demo Prep Loop card: deck-plan display plus deck download actions.
- **Copy / download action area** — copy and download buttons rendered in each artifact's actions row.

---

## 4. Inputs the UI must support

All inputs below are collected client-side and posted to `POST /api/analyze`. The server normalizes every source mode into a single `{ requirementText, rawDiff }` before analysis.

| Input | Field(s) today | Status | Notes |
|---|---|---|---|
| **Project name** | `projectName` (text) | Implemented | Labeled "display only" in the UI, but it is **functionally the memory key** — project memory is stored/loaded per project name. Design should treat it as meaningful, not decorative. |
| **Source mode** | `inputMode` select: `manual`, `githubUrl`, `websiteContextUrl`, `notionText` | Implemented | Switching mode shows the relevant fields + a one-line description. |
| **Requirement / spec text** | `requirementText` (manual), `gh_requirementText` (GitHub mode) | Implemented | The spec the change is measured against. |
| **Diff text** | `rawDiff` (manual), `ws_rawDiff` (website mode), `nt_rawDiff` (Notion mode) | Implemented | A unified git diff. Required in every mode except GitHub (where it is fetched). |
| **GitHub PR/commit URL** | `githubUrl` | Implemented | Public PR (`…/pull/123`) or commit (`…/commit/<sha>`) URL; the server fetches the `.diff`. Requirement still typed by hand. |
| **Website / spec URL** | `websiteUrl` | Implemented | Page text is fetched and used as the **requirement/context**; the diff is still required. |
| **Notion text** | `notionText` | Implemented | Pasted/exported Notion content used as the requirement. **Real Notion OAuth is future** — note this in the UI copy. Diff still required. |
| **Previous progress / today goal** | — | Backend-ready, **not exposed in UI** | The Daily Work Guidance skill accepts `previousProgressMemory` and `todayGoal`; today these come from memory, not a form field. Design may add optional fields for them (future-ready). |
| **Artifact generation actions** | include flags (below) | Implemented | Not raw checkboxes for the user — driven by per-artifact "Generate" buttons. |
| **Debug toggle** | `debug-toggle` (checkbox) | Implemented | Reveals a Raw JSON developer view. |

**Artifact include flags** (sent on `/api/analyze`; the UI sets these based on which buttons the user clicks, not as a manual checklist):
`includeFlow`, `includeGapReport`, `includePrDescription`, `includeVideoScript`, `includeDailyUpdate`, `includeDailyWorkGuidance`, `includeTechnicalChangeBrief`, `includeDemoPrepLoop`, `includeWeeklyReview`.

- **Initial analysis** sends `includeFlow = true`, `includeGapReport = true`, all others `false`.
- **On-demand generation** re-sends the resolved inputs + `sessionId`, keeps already-generated outputs' flags on, and turns on the requested artifact's flag plus its dependencies.

---

## 5. Artifact cards

There are **4 base artifacts** (produced by Initial Analysis) and **7 on-demand artifacts** (generated later), plus a debug **Raw JSON** view. Each card has: a friendly label, a group, a one-line description, a state (generated / not-generated), a rendered body, and an actions row.

Every card supports these **states** uniformly:
- **not generated yet** → friendly empty state + a "Generate …" button (base artifacts are effectively always generated after initial analysis).
- **generating** → "Generating … this can take a little while."
- **generated** → rendered body + actions row.
- **error** → the actual error message + a "Try again" button.

### Base analysis (produced by Initial Analysis)

#### Initial Analysis (the four base artifacts)
- **What Changed** (`changeExplanation`) — plain-language explanation of the change. Shows: change story, key functionalities, flow, main components (name + responsibility), architectural decisions, impact analysis, uncertainties. No copy/edit action today.
- **Requirement Check** (`requirementAlignment`) — how well the change matches the requirement. Shows: requirement summary, satisfied / partially-satisfied / missing / unclear items, overall assessment, and **confidence** (high/medium/low). Feeds the Overview.
- **PR Readiness** (`gapReport`) — whether it's ready to open as a PR. Shows: **readiness** value, completed work, remaining gaps, partial items, unclear items, risks, recommended next actions, PR recommendation. Feeds the Overview readiness badge.
- **Feature Flow** (`flowArtifact`) — the runtime flow the change introduces. Shows: title, description, steps, and a **mermaid** diagram string (a redesign may render this as a diagram).
- **Actions**: none beyond viewing today (no copy/download). Overview summarizes readiness + confidence and lists next actions.

### On-demand outputs

#### Daily Work Guidance (`dailyWorkGuidance`)
- **Purpose**: "how do I work today" — yesterday vs. the spec, blockers, decisions, and an approvable plan.
- **Sections displayed**:
  - `yesterdaySummary`
  - `progressVsSpec[]` (item, previousStatus?, whatChanged, newStatus, evidence, confidence)
  - `advancedChecklistItems[]`
  - `blockersAndRisks[]` (title, description, whyItMatters, requiredAction, severity?)
  - `decisionsNeedingApproval[]` (decision, context, options?, recommendedOption?, status = pending_approval)
  - `plannedSteps[]` (id, title, whyItMatters, expectedOutput, **cursorPrompt**, validationChecklist[], relatedSpecItems?, status = pending_approval)
  - `notionDailyUpdate` (yesterday, today, blockers, decisionsNeeded, progressVsSpec, nextCursorPrompt)
  - `memoryUpdate` (date, dailySummary, checklist statuses, new decisions, open blockers, next actions)
- **Actions**:
  - Copy full artifact ("Copy Daily Work Guidance")
  - Copy **Notion daily** (the fixed Notion-ready block)
  - Copy **each planned step's Cursor prompt** ("Copy Prompt: <step title>" — one button per step)
  - **Save to memory**
- **Emphasis**: the plan is explicitly **not final** — every step/decision is `pending_approval`. Design should make approval-pending state visually clear.

#### Technical Change Brief (`technicalChangeBrief`)
- **Purpose**: a structured, implementation-focused explanation of the change.
- **Sections displayed** (section by section):
  - `executiveSummary`
  - `dataSchemaChanges` (hasChanges, summary, new/changed/removed fields, new schemas, changed parser contracts, new status values, persisted-data impact, backward compatibility + note)
  - `modelsAndTypes[]` (name, filePath?, represents, whyNeeded, importantFields[], evidence)
  - `inputsApiFlags[]` (name, kind, description, filePath?, evidence)
  - `workflowRuntimeChanges` (summary, whereItRuns, dependsOn, consumes, produces, cached/reused, behavior when flag off)
  - `uiChanges` (hasChanges, summary, new cards/views, toggles/buttons, copy actions, sections, how to activate)
  - `interestingFunctionality[]` (title, whatItDoes, whyItMatters, howItWorks, filesInvolved)
  - `howItWorksStepByStep[]` (actor?, action, detail?)
  - `filesWorthShowing[]` (path, whyItMatters, whatToPointOut)
  - `talkingPoints[]`
- **Actions**:
  - Copy full artifact ("Copy Technical Change Brief")
  - Copy **Talking points**
  - Copy **Files worth showing**
- **Evidence tagging**: many items carry `confirmed` vs `inferred`. Design should surface this distinction (e.g. a subtle tag).

#### Demo Prep Loop (`demoPrepLoop`)
- **Purpose**: an approval-gated plan for demoing/presenting the change, plus a downloadable deck.
- **Sections displayed**:
  - `loopStatus` (currentStage, overallStatus, nextRecommendedAction, whatNeedsUserApproval[])
  - `demoStoryProposal` (problem, solution, technicalChange, userOrProductValue, proofOrDemoMoment, limitationsOrNextSteps, status)
  - `walkthroughOrder[]` (order, title, filePath?/areaName?, type, whyThisComesHere, whatToShow, whatToSay, whatToSkip, estimatedTimeSeconds, mustShow, evidence, status)
  - `codeEvidencePlan[]` (filePath?/areaName?, evidenceType, whatItProves, whyItMatters, confidence, evidence, status)
  - `screenshotPlan[]` (id, title, type, filePath?/codeArea?/lineRange?/uiArea?, whatToCapture, whyThisMatters, whatToSay, suggestedCaption, mustShow, status) — screenshots are captured **manually** by the user; the app only plans them.
  - `approvalQuestions[]` (question, whyItMatters, options[], recommendedOption?, status)
  - `deckPlan[]` (slideNumber, title, purpose, visualType, screenshotIds?, whatToShow, **onSlideText[]** = what appears on the slide, **speakerNotes** = what to say live, **narrationScript** = what to say on video, transitionToNextSlide, estimatedTimeSeconds, mustHave, status)
  - `draftVideoScript` (title, estimatedDuration, sections[] with kind/title/narration/visualCue/time)
  - `finalShortPitch` (30–45s pitch)
  - `readinessChecklist[]` (item, why, done)
- **Actions** (copy):
  - Copy full artifact ("Copy Demo Prep Loop")
  - Copy **Walkthrough order**
  - Copy **Screenshot plan**
  - Copy **Deck plan**
  - Copy **Speaker notes**
  - Copy **Narration script**
  - Copy **Short pitch**
  - Copy **Markdown deck**
- **Actions** (download):
  - **Download deck (.md)** → `demo-deck.md` (text/markdown)
  - **Download PPTX deck** → `demo-deck.pptx` (base64 → binary; real PowerPoint file)
- Both deck files are built deterministically from `deckPlan` + `screenshotPlan`.

#### Weekly Review (`weeklyReview`)
- **Purpose**: the weekly synthesis — progress vs spec, technical changes, decisions, demo/video story, and next week.
- **Sections displayed**:
  - `status` (status, confidence, missingInputs[], reviewPeriodLabel, generatedAt)
  - `executiveSummary`
  - `progressAgainstSpec[]` (title, status, evidence, notes, source)
  - `whatChangedTechnically` (schema/data, model/type, workflow/runtime, UI, tools/skills added, important files)
  - `keyDecisions[]` (decision, why, impact, status, source)
  - `blockersAndRisks[]` (title, whyItMatters, status, suggestedNextAction)
  - `demoVideoStory` (strongestStory, whatToShow[], whatToSay[], whatToSkip[], recommendedStructure[], keyFilesOrScreens[], strongestProductSentence)
  - `reviewTalkingPoints[]`
  - `suggestedWeeklyUpdate` (thisWeek, technicalProgress, demoProductProgress, blockers, nextWeek)
  - `nextWeekPlan[]`
  - `memoryUpdateProposal` (latestWeeklySummary, checklist statuses, new decisions, updated blockers, next actions, demoStorySummary, filesWorthShowing)
- **Actions**:
  - Copy full artifact ("Copy Weekly Review")
  - Copy **Weekly update**
  - Copy **Demo / video story**
  - Copy **Talking points**
  - Copy **Next week plan**
  - Copy **Memory update proposal**
  - **Save to memory**

#### Also present today (older "actions" artifacts — keep, lower emphasis)
- **PR Draft** (`prDescription`) — ready-to-paste PR description. Copyable **and chat-editable**. Depends on Feature Flow + PR Readiness.
- **Walkthrough Script** (`videoScript`) — short spoken walkthrough. Chat-editable. Depends on Feature Flow + PR Readiness.
- **Daily Prep** (`dailyUpdate`) — standup-ready summary. Chat-editable. Depends on Feature Flow + PR Readiness + PR Draft.

> **Side chat editing**: PR Draft, Walkthrough Script, and Daily Prep are the only **editable** artifacts. When one is selected, a side chat lets the user request edits ("make this shorter"), which update the card in place, with an **Undo last edit**. All other artifacts are read-only (chat panel shows "editing available for generated text artifacts only"). The redesign should keep a place for this chat, but it is not the primary interaction.

#### Project Status / Memory (`projectMemory` panel — not an analysis artifact)
- **Purpose**: make stored memory a visible **Project Status**, not hidden storage.
- **View mode shows**:
  - project name + project id, active spec summary, "loaded for this run: yes/no"
  - saved **snapshot**: latest summary (+ date), checklist statuses (item: status), decisions, blockers, next actions, last-updated timestamp
  - **personal working preferences** (general prefs + category lists: Cursor, Claude Code, code review, daily update, weekly review, demo/video, mentor/manager update)
  - empty state when no memory: "No saved project memory yet. Generate Daily Work Guidance or Weekly Review and save it to memory."
- **Actions**: **Edit memory**, **Clear project memory** (only shown when a snapshot exists).
- **Edit mode**: two editable JSON areas (project memory + preferences), **Save memory** / **Cancel**, inline validation errors. Checklist status must be one of `not_started, partial, done, blocked, unclear`. (A redesign may replace raw JSON with structured form fields — the save contract is the important part; see §8.)

---

## 6. Actions inventory

Every action the new UI must be able to trigger (all already backed by an endpoint or client behavior):

**Analysis / generation**
- Run Initial Analysis
- Generate Daily Work Guidance
- Generate Technical Change Brief
- Generate Demo Prep Loop
- Generate Weekly Review
- Generate PR Draft / Walkthrough Script / Daily Prep (older outputs)
- Try again (re-generate after an artifact error)
- View (open a generated artifact from an Overview tile)

**Copy** (clipboard; button briefly shows "Copied")
- Copy full artifact (PR Draft, Daily Work Guidance, Technical Change Brief, Demo Prep Loop, Weekly Review)
- Copy Notion daily (Daily Work Guidance)
- Copy Cursor prompt — one per planned step (Daily Work Guidance)
- Copy Talking points (Technical Change Brief, Weekly Review)
- Copy Files worth showing (Technical Change Brief)
- Copy Walkthrough order / Screenshot plan / Deck plan / Speaker notes / Narration script / Short pitch / Markdown deck (Demo Prep Loop)
- Copy Weekly update / Demo-video story / Next week plan / Memory update proposal (Weekly Review)

**Download**
- Download Markdown deck (`demo-deck.md`)
- Download PPTX deck (`demo-deck.pptx`)

**Memory**
- Save memory update (from Daily Work Guidance)
- Save memory update (from Weekly Review)
- Edit memory (project memory + preferences)
- Save memory edit / Cancel memory edit
- Clear project memory (with confirmation)
- Refresh memory status (memory status is returned by analyze/save/edit/clear responses; the panel refreshes from those)

**Editing (side chat)**
- Send chat edit (PR Draft / Walkthrough Script / Daily Prep)
- Undo last edit

**Navigation / view**
- Select nav item (Overview, Project Memory, any artifact, Raw JSON)
- Switch source mode
- Toggle "Show debug data" (Raw JSON)

---

## 7. UI states

The redesign must represent all of these states:

**App / input**
- **Empty project state** — no analysis run yet; workspace hidden, placeholder shown ("Your analysis workspace will appear here after you run an initial analysis.").
- **Ready to analyze** — status idle: "Ready when you are."
- **Analyzing** — status loading, cycling through steps every ~2.5s: "Understanding the code change…", "Checking it against the requirement…", "Preparing your analysis workspace…". Run button disabled.
- **Mode banner** — mock/demo vs. real engine (see §10).

**Per artifact**
- **Not generated yet** — friendly empty state + "Generate <artifact>" button.
- **Generating** — "Generating <artifact>… this can take a little while." (nav chip shows "Generating").
- **Generated** — rendered body + actions.
- **Cached / reused** — after generation, artifacts persist for the session; re-selecting shows them instantly (no regeneration). Generation of a new artifact reuses base artifacts silently.
- **Artifact error** — inline error text with the actual message + "Try again".

**Action feedback**
- **Copy success** — button label flips to "Copied" for ~1.2s, then reverts.
- **Download** — triggers a browser file download. (No explicit success/failure toast today — a redesign may add one; failure surfaces only if the payload is malformed.)

**Memory**
- **Memory saved** — success status: "Saved progress for "<project>" (<date>). It will inform the next run." Panel refreshes.
- **Memory empty** — "No saved project memory yet…" empty state.
- **Memory load error** — `loadError` shown in the panel (e.g. corrupted store) without crashing.
- **Memory clear confirmation** — a confirm step ("Clear saved project memory for this project? This cannot be undone.") before clearing; success status after.
- **Memory edit validation error** — inline error when JSON is invalid or a checklist status is not allowed; nothing is saved.

**System / integration**
- **Integration / source unavailable** — e.g. GitHub diff 404 / private, website unreachable, empty diff; surfaced as a verbatim error message in the status line.
- **Parser / model error** — invalid model output fails closed and returns a verbatim error (shown in status or the artifact error state).
- **General error** — request failed / not-found / bad JSON body → verbatim error in the status line.

> **Honesty rule**: all error messages are shown **verbatim** (the real backend message). The UI never invents a friendly-but-wrong error. Keep this.

---

## 8. Data contract summary

High-level contract so components can be built against real shapes. All endpoints are `POST` and return JSON with a `status: 'success' | 'error'` discriminator; error responses always carry a verbatim `message`.

### Endpoints
| Endpoint | Purpose |
|---|---|
| `GET /` | The single-page HTML shell (mode injected). |
| `POST /api/analyze` | Initial analysis **and** on-demand generation (same endpoint). |
| `POST /api/sessions/:sessionId/save-memory` | Persist a run's proposed memory update. |
| `POST /api/sessions/:sessionId/chat-edit` | Edit an editable artifact via chat. |
| `POST /api/sessions/:sessionId/undo-artifact-edit` | Undo the last chat edit. |
| `POST /api/memory/edit` | Save edited project memory and/or preferences. |
| `POST /api/memory/clear` | Clear the active project's memory. |

### Analyze request (what the UI sends)
```
{
  inputMode: 'manual' | 'githubUrl' | 'websiteContextUrl' | 'notionText',
  projectName?: string,
  sessionId?: string,              // present → on-demand generation reuses this session
  requirementText, rawDiff,        // manual fields
  githubUrl, websiteUrl, notionText, // mode-specific (empty when unused)
  includeFlow, includeGapReport,
  includePrDescription, includeVideoScript, includeDailyUpdate,
  includeDailyWorkGuidance, includeTechnicalChangeBrief,
  includeDemoPrepLoop, includeWeeklyReview
}
```

### Analyze response (success)
```
{
  status: 'success',
  mode: 'real' | 'mock',
  sessionId: string,
  overview: { readiness: string | null, confidence: string },
  inputs: { requirementText, rawDiff },   // echoed for follow-up generation
  cards: WorkspaceCard[],
  memory: MemoryStatus
}
```

### WorkspaceCard (the render unit for every artifact)
```
{
  id, label, group: 'understanding' | 'actions' | 'debug',
  state: 'generated' | 'not_generated',
  html,                              // pre-rendered, escaped body
  copyText?: string,                 // primary "copy full artifact"
  copyActions?: { label, text }[],   // extra labeled copy buttons
  downloadActions?: {                // file downloads
    label, filename, mimeType,
    text?  | base64?                 // exactly one is set (text vs binary)
  }[]
}
```

### Artifact objects that exist
`changeExplanation`, `requirementAlignment`, `gapReport`, `flowArtifact` (base); `prDescription`, `videoScript`, `dailyUpdate`, `dailyWorkGuidance`, `technicalChangeBrief`, `demoPrepLoop`, `weeklyReview` (on-demand); `rawJson` (debug). Field shapes are enumerated in §5.

### On-demand generation (how it works)
- The client keeps `sessionId` + `inputs` from the first analyze response.
- To generate artifact X, it re-`POST`s `/api/analyze` with `inputMode:'manual'`, the stored `sessionId`, the stored `requirementText`/`rawDiff`, base flags on, already-generated outputs' flags on, and X's flag (+ its dependencies) on.
- The engine **reuses** existing artifacts and only runs the newly requested skill(s). No re-fetch of GitHub/website; no recompute.
- Dependencies: PR Draft, Walkthrough Script, Daily Work Guidance require Feature Flow + PR Readiness; Daily Prep also requires PR Draft. Technical Change Brief, Demo Prep Loop, and Weekly Review require only the base analysis.

### Save memory
`POST /api/sessions/:id/save-memory` with `{ projectName, source: 'dailyWorkGuidance' | 'weeklyReview' }`.
- Requires a project name (memory is per project).
- Reads the session's cached artifact, maps its proposed memory update into a durable snapshot, appends it, and persists.
- Returns `{ status, message, savedDate, memory: MemoryStatus }`.
- **Model output is never saved automatically** — only on this explicit action.

### Clear memory
`POST /api/memory/clear` with `{ projectName }` → `{ status, memory: MemoryStatus }`. Clears **project** memory only (never personal preferences).

### Edit memory
`POST /api/memory/edit` with `{ projectName, project?, preferences? }` → `{ status, message, memory: MemoryStatus }`. Validates and **fails closed** (bad JSON / invalid checklist status → nothing saved for that section). Edits shape **future runs only**; current session artifacts are unchanged.

### MemoryStatus (Project Status panel data)
```
{
  projectName?, projectId?, activeSpecSummary?,
  loadedForThisRun: boolean,
  snapshot?: {
    latestSummary, date,
    checklistStatuses: { item, status }[],
    decisions[], blockers[], nextActions[], updatedAt
  },
  promptPreferences?: {
    general?: { preferredLanguage?, preferredTone?, preferredOutputLength?,
                preferredStructure?, includeConciseSummaries?, includeDetailedImplementationPrompts? },
    cursor?[], claudeCode?[], codeReview?[], dailyUpdate?[],
    weeklyReview?[], demoVideo?[], mentorUpdate?[]
  },
  loadError?: string
}
```

### Downloads (how they're triggered)
Downloads are **client-side**: `downloadActions` on a card carry either `text` (for `.md`) or `base64` (for `.pptx`); the client turns the payload into a Blob and triggers a download with `filename` + `mimeType`. No download endpoint.

---

## 9. Design priorities for Claude Design

The new UI should feel like a **serious developer tool**, not a toy or a chatbot:

- **Clean workspace**, artifact-centric — the analysis and its artifacts are the product; the input form recedes after analysis.
- **Not chat-first** — chat exists only as a secondary edit affordance for a few artifacts.
- **Clear left-to-right / top-to-bottom progression**: input → analysis → guidance → review → presentation. Make the "run once, then generate on demand" model obvious (base artifacts vs. generatable outputs, with status chips).
- **Strong visual hierarchy** for dense, structured, sectioned content (each artifact has many labeled sections; see §5). Group and let users scan.
- **Readable technical content** — code paths, diffs, mermaid flow, schema/field lists, and `confirmed` vs `inferred` evidence tags should be legible and skimmable.
- **Fast copy/download actions** — copy and download are core; make them obvious, per-section, with clear "Copied" feedback. The demo deck download (MD + PPTX) is a highlight.
- **Easy to demo** — the flow itself should be presentable; the Overview should orient a viewer immediately (readiness badge + confidence + next actions).
- **Memory should feel like "Project Status"** — a first-class, visible panel (progress snapshot, decisions, blockers, next actions, preferences), not hidden storage. Approval-pending plans/decisions should read as "awaiting your approval."
- **Honesty affordances** — keep the real/mock mode banner and verbatim error messages; never present demo/mock data as real.

---

## 10. MVP vs future

### Currently implemented (must be fully supported by the new UI)
- Project name + four source modes (manual, GitHub URL → fetched diff, website URL → fetched requirement text, pasted Notion text).
- Initial analysis → base artifacts: What Changed, Requirement Check, PR Readiness, Feature Flow.
- Overview (readiness badge, confidence, next-action tiles).
- On-demand generation with session reuse + status chips.
- Daily Work Guidance (+ Notion-daily copy, per-step Cursor-prompt copy, Save to memory).
- Technical Change Brief (+ talking points / files-worth-showing copy).
- Demo Prep Loop (+ section copies, **Markdown deck download**, **PPTX deck download**).
- Weekly Review (+ section copies, Save to memory).
- PR Draft, Walkthrough Script, Daily Prep (copy + **side-chat editing** with undo).
- Project Memory / Project Status panel: view snapshot, edit memory (project + preferences), save, clear, empty & load-error states.
- Loading, success, and verbatim error states; copy "Copied" feedback.
- Real vs. mock/demo mode banner.
- Raw JSON behind a debug toggle.

### Future-ready / not fully wired (design should leave room, but not make primary)
- **Real Notion / GitHub integrations** — a connectors layer exists and can run in real mode behind a feature flag (default page/PR), but there is **no UI** for connecting accounts, browsing PRs/pages, or write-back. Today's "GitHub URL / Notion text" modes are the exposed surface. Leave space for a future "Connected sources" area.
- **Notion export / write-back** — connector supports append, not surfaced in UI.
- **`previousProgressMemory` / `todayGoal` as form inputs** — backend accepts them; today they come from memory only. Optional future fields.
- **Approval buttons** — plans/decisions are marked `pending_approval`, but there is **no accept/reject action** yet; today the user just copies/edits. A future approval interaction could act on these.
- **Advanced / structured memory editing** — editing is raw-JSON today; a structured form editor is a natural future improvement (keep the same save contract).
- **Automatic screenshots** — the Demo Prep Loop *plans* screenshots; capture is manual. No capture automation.
- **Scheduling, Telegram/Slack channels, always-on monitoring, auth, deploy** — explicitly out of scope; do not design primary surfaces for these.
```
