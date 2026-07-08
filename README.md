# Developer Work Companion

A Developer Work Companion that analyzes a **code change** against a **spec**,
generates useful communication artifacts, and runs a **human-in-the-loop
planning cycle** with durable memory. It turns "here's my diff and my
requirement" into a source-of-truth analysis (what changed, what progressed
against the spec, what's still risky) and then proposes a plan you review and
steer. Every plan is self-critiqued once by the model but **only you** can
approve, edit, reject, or defer a step. Progress is remembered across runs, so
the next session picks up where the last one left off.

Reasoning lives in LLM-backed **skills**; the harness only orchestrates them.
Provider-free **mock** models let the whole pipeline — including the agentic
planning loop — run with **zero configuration and no API keys**.

## Who it's for

Developers working on multi-step tasks who need to quickly see:

- **what changed** in the diff,
- **what progressed** against the spec,
- **what to do next** (a reviewed, ordered plan),
- **what to report** (daily update / technical brief / weekly review / demo prep),
- **what to ask Cursor/Claude next** (each planned step ships a ready prompt).

## Core demo flow

This is the fastest path to see the agentic loop. It works in **mock mode** (no
keys); real model text requires env config (see below).

1. **Run the UI**: `npm run ui`, then open <http://localhost:5173>.
   Mock/demo mode is the default — no keys needed.
2. **Provide input**: paste a spec + diff (or a public GitHub PR URL), or just
   use the prefilled mock data. Give it a **project name** (this keys memory).
3. **Generate Daily Work Guidance**: run the analysis and open the Daily Work
   Guidance artifact. It contains progress-vs-spec, blockers, and an ordered
   plan of steps — each step with a why, an expected output, and a Cursor prompt.
4. **See the Plan Self-Review**: the guidance includes a `selfCritique` section —
   the model critiqued its own plan once and (at most once) revised it.
5. **Approve one step**: mark a step `approve`.
6. **Edit or reject a step with a reason**: `edit` a step's text, or `reject` /
   `defer` another and add a note explaining why.
7. **Apply decisions**: submit them. The plan advances and your decisions are
   recorded.
8. **See the revised plan / re-planning**: applying decisions can drive a
   model-in-the-loop re-plan of the remaining work — but **every newly proposed
   step comes back as `pending_approval`**; nothing auto-approves.
9. **Watch `loopStatus` advance**: the guidance loop status moves as you review
   (proposal → decided/refined), so you can see where the cycle stands.
10. **Memory is saved**: save the project memory (latest summary, checklist
    statuses, blockers, decisions, next actions).
11. **Run again with the same project**: re-run analysis with the same project
    name and the prior progress is **reloaded as context** — the companion
    remembers where you were.

## How to run

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # node --test (unit tests, no network, no keys)
npm run ui          # UI at http://localhost:5173 (mock/demo mode by default)
```

### Real model mode (optional)

Mock mode needs nothing. To use a real OpenAI-compatible provider:

```bash
cp .env.example .env
# then set in .env:
UI_MODE=real
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
# OPENAI_BASE_URL=...   # optional, for OpenAI-compatible gateways
```

`npm run ui` loads `.env` automatically. There is also a manual, dev-only smoke
test against the real provider (never part of `npm test`, may cost money):

```bash
npm run smoke:real-ai
```

Secrets are read only from the environment, never hardcoded or logged. `.env` is
gitignored; `.env.example` is tracked.

## Mock mode vs real mode

- **Mock mode (default)** — clearly-labeled fake data, no AI calls, no keys.
  Safe for demos and CI. The **full agentic loop** (generation → self-critique →
  approve/edit/reject/defer → apply → re-plan → memory) can be demonstrated here;
  the loop mechanics are deterministic code, not the model.
- **Real mode (`UI_MODE=real`)** — uses your OpenAI-compatible provider for the
  actual reasoning/text. Requires `OPENAI_API_KEY` + `OPENAI_MODEL`.

The loop's **safety and control logic runs identically in both modes** — only
the wording of artifacts differs.

## Evidence / tests

- **555 / 555 unit tests passing** (`npm test`), **typecheck clean**
  (`npm run typecheck`). Both run with no network and no keys.
- **Self-critique** pass and its safety boundary:
  [`src/analysis/guidanceSelfCritique.ts`](src/analysis/guidanceSelfCritique.ts),
  [`src/skills/dailyWorkGuidanceCritique/`](src/skills/dailyWorkGuidanceCritique/)
  (see `__tests__/GuidanceCritiqueSkill.test.ts`).
- **Approve / edit / reject / defer loop**:
  [`src/analysis/applyGuidanceDecisions.ts`](src/analysis/applyGuidanceDecisions.ts)
  (`__tests__/applyGuidanceDecisions.test.ts`).
- **Daily Work Guidance** generation and parsing:
  [`src/skills/dailyWorkGuidance/`](src/skills/dailyWorkGuidance/).
- **Memory persistence / reload across runs**:
  [`src/memory/`](src/memory/) — in-memory, JSON file, and DB stores, with
  `__tests__/` for each store and the resolver.
- **Prompt-injection defense**:
  [`src/skills/shared/untrustedContent.ts`](src/skills/shared/untrustedContent.ts)
  (`src/skills/shared/__tests__/untrustedContent.test.ts`).
- **PPTX / deck export**:
  [`src/tools/presentation/`](src/tools/presentation/)
  (`__tests__/pptxDeckBuilder.test.ts`).

## Safety and control

- **The model cannot approve its own plan.** The self-critique may reframe or add
  approval points but never remove them, and **every revised step re-enters as
  `pending_approval`** with an id assigned by code, not the model.
- **User decision required.** Steps and open decisions advance only through your
  explicit `approve` / `edit` / `reject` / `defer` (with an optional reason).
- **Bounded self-critique.** The critic runs **exactly once** per generation — no
  retry, no iteration. If it fails or returns invalid output, the original plan
  is shown with a visible note; generation never fails because of critique.
- **Prompt-injection defense.** Untrusted material (diffs, Notion/website text,
  saved memory) is fenced with unambiguous delimiters and a safety preamble; it
  is treated as data, never instructions, and attempts to forge the fence are
  neutralized.
- **LLM guardrails.** Provider calls have a request **timeout** (`OPENAI_TIMEOUT_MS`)
  and an output **token cap** (`OPENAI_MAX_TOKENS`); raw model output is never
  exposed in the product UI, and failures fail closed.
- **Telegram (if enabled) is user-initiated only.** It responds to a user's
  command in an allow-listed chat and acts as a thin command interface over the
  **same** analysis workflow and `MemoryStore` the UI uses (no duplicated logic).
  It never messages third parties autonomously, never auto-saves memory (`/save`
  is explicit), requires `/clear confirm` to clear, validates the webhook secret,
  and never logs the bot token. See
  [`docs/integrations-setup.md`](docs/integrations-setup.md).

## Architecture summary

```
UI / API            src/ui, api/index.ts   (thin HTTP + request handlers; no reasoning)
  │
Sources/connectors  src/sources            (GitHub .diff, Notion read — external I/O only)
  │
Analysis harness    src/analysis           (orchestration, workflow, self-critique, apply-decisions)
  │  uses
Skills              src/skills             (all LLM reasoning: change explanation, requirement
  │                                          alignment, gap report, daily work guidance + critique,
  │                                          technical brief, demo prep, weekly review, artifact edit)
  │
Memory              src/memory             (in-memory / JSON file / DB stores behind one interface)
  │
Presentation tools  src/tools/presentation (Markdown + PPTX deck builders)
```

- **Harness** ([`src/analysis/AnalysisHarness.ts`](src/analysis/AnalysisHarness.ts))
  wires adapters and skills into the workflow, stores sessions, reuses artifacts
  ("analyze once, work from the analysis"), and builds the unified project
  context. It builds no prompts and parses no model output.
- **Workflow** ([`src/analysis/AnalyzeCodeChangeWorkflow.ts`](src/analysis/AnalyzeCodeChangeWorkflow.ts))
  runs steps in order and skips any step whose artifact already exists.
- **Skills** carry all reasoning; inject real `LanguageModel`-backed skills, a
  shared model, or mock models.

## Persistence

Memory is storage-agnostic behind one `MemoryStore` interface, selected by
`MEMORY_STORE`:

- `file` (default) — durable JSON files under `MEMORY_DATA_DIR` (great locally).
- `memory` — in-memory (tests / ephemeral).
- `db` — external **Postgres** via `DATABASE_URL`, for durable
  production/serverless persistence (tables auto-create on first use). Works with
  any standard Postgres; **Supabase** is the recommended managed provider (no
  Supabase SDK/Auth/Storage — just the connection string).

See [`docs/integrations-setup.md`](docs/integrations-setup.md) for DB, Notion,
GitHub, and Telegram setup and the full environment-variable reference.
