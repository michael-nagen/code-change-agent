# Integrations Setup Guide (Notion, GitHub, DB memory & Telegram)

This guide is for the person **setting up and running the app** — not only for a
developer reading the code. It explains how to connect real Notion and GitHub
sources so they become part of the analysis context.

> Status: this is the **real-ready integration layer**. The wiring, connectors,
> config resolver, and unified-context builder are implemented. Connected Notion
> content is fed into the Daily/Technical/Demo/Weekly artifacts as supporting
> context, and generated artifacts can be **explicitly** sent back to Notion.
> There is **no UI yet** for picking sources — sources are configured through
> environment variables.

---

## 1. What this integration layer does

When you run an analysis, the app assembles **one unified project context** from
whatever is available:

- **Manual input still works.** The requirement/spec and diff you paste are the
  **source of truth**. Nothing here changes that.
- **Memory is loaded as context.** Previously saved project memory is included as
  supporting context (it never overrides your current input).
- **Notion / GitHub can be configured as sources.** When enabled, the app reads a
  Notion page and/or a GitHub PR behind the scenes.
- **All sources become a unified `NormalizedProjectContext`**, attached to the
  analysis session and included in the analysis result (`result.projectContext`),
  with a human-readable `sourceSummary`.
- **No UI is exposed yet.** Sources are configured via environment variables.

If integrations are **disabled** (the default) or misconfigured, the app still
runs normally on your manual input — external sources are simply skipped.

---

## 2. Notion setup

1. **Create a Notion integration.** Go to <https://www.notion.so/my-integrations>
   → **New integration** → give it a name → create it. Choose the internal
   integration type.
2. **Copy the Notion API secret** (the "Internal Integration Secret"). Keep it
   private.
3. **Share the relevant Notion page with the integration.** Open the page →
   **•••** menu → **Connections / Add connections** → select your integration.
   The integration can only read pages that are explicitly shared with it.
4. **Copy the page URL or page ID.** The page id is the 32-hex string at the end
   of the page URL (dashes optional). A full URL also works.
5. **Set env vars** (e.g. in `.env`):

   ```env
   SOURCE_INTEGRATIONS_ENABLED=true
   NOTION_API_KEY=secret_xxx
   NOTION_DEFAULT_PAGE_ID=https://www.notion.so/Your-Page-0123456789abcdef0123456789abcdef
   ```

6. **Restart the app.**
7. **Run a test analysis** (paste any requirement + diff and run).
8. **Verify Notion is included** in the normalized source context and used by the
   artifacts — see [How to verify](#4-how-to-verify).

### Notion read context (what happens on a run)

When Notion is configured, each analysis run:

- **fetches the configured default page** (`NOTION_DEFAULT_PAGE_ID`) behind the
  scenes;
- **attaches it to `projectContext.sources`** and shows it in the workspace
  **Sources** panel;
- **feeds a short, capped, clearly-delimited summary into the relevant skills**
  as **supporting context** — specifically **Daily Work Guidance, Technical
  Change Brief, Demo Prep, and Weekly Review**.

It is true that **configured Notion page content is included as supporting
context for the Daily, Technical, Demo, and Weekly artifacts.**

Priority is explicit and enforced in the prompt:

- your **pasted requirement/spec and diff are the source of truth**;
- connected **Notion/GitHub content is supporting context only**;
- if connected context conflicts with your current inputs, the model is told to
  **call out the conflict and prefer your inputs**, and never to invent source
  claims.

If Notion is unavailable (wrong id, not shared, network error), the run **fails
open**: the Notion source is skipped with a warning and the analysis still
completes on your manual input.

**Limitations**

- No Notion UI picker yet, and no full workspace browser.
- Only the **first page of top-level blocks** is read (no deep nesting or
  pagination) — enough for a spec page, not a large database.
- Page access depends entirely on the page being **shared** with the integration.

### Notion write-back (explicit, user-triggered)

You can also **send generated artifacts back to the configured Notion page**.
Every write is **explicit** — there is **no automatic or background write**, and
nothing is ever written just because an artifact was generated.

Supported write-backs (each appended to the configured page under a dated title):

| Artifact | Title | Content |
|----------|-------|---------|
| Daily Work Guidance | `Daily Work Guidance — YYYY-MM-DD` | yesterday, today, blockers, decisions needed, progress vs spec, next Cursor/Claude prompt |
| Weekly Review | `Weekly Review — <period>` | this week, technical progress, demo/product progress, blockers, next week |
| Demo Prep Summary | `Demo Prep Summary — YYYY-MM-DD` | demo story, walkthrough order, screenshot/slide plan, short pitch, deck status |
| Project Memory Snapshot | `Project Memory Snapshot — YYYY-MM-DD` | active spec summary, latest summary, checklist statuses, decisions, blockers, next actions, last updated |

**From the workspace UI:** generate the artifact, then click **Send Daily to
Notion** / **Send Weekly to Notion** / **Send Demo Summary to Notion** (on the
matching card), or **Send Memory Snapshot to Notion** on the Project Memory
panel. Success and error messages are shown inline.

**From Telegram:** run an explicit command — `/notion daily`, `/notion weekly`,
`/notion demo`, or `/notion memory` (alias: `/send-notion …`). Generating with
`/daily`, `/weekly`, or `/demo` never writes to Notion by itself. On success the
bot replies `Sent to Notion.`

**Requirements & behavior**

- Requires `NOTION_API_KEY` and a target page (`NOTION_DEFAULT_PAGE_ID`, or an
  explicit page id/URL in the request).
- If the artifact has not been generated (or no memory is saved yet), you get a
  clear error and **nothing is written** — content is never invented.
- Content is formatted **deterministically** from the existing artifact (no LLM
  call); long content is split into multiple appended paragraphs.
- Write-back **appends** to the page; it does not create pages or edit existing
  blocks. It **reuses the same Notion connector** used for reading.
- The `NOTION_API_KEY` is **never logged** and never returned in a response.
- There is **no GitHub write-back** — GitHub remains read-only.

---

## 3. GitHub setup

1. **Use a public PR URL**, or create a GitHub token for private repos.
2. **If a token is needed** (private repos, or to avoid public rate limits),
   create a **fine-grained personal access token** with the minimum scope
   (read-only access to the specific repository / pull requests).
3. **Set env vars:**

   ```env
   SOURCE_INTEGRATIONS_ENABLED=true
   GITHUB_TOKEN=ghp_xxx            # optional for public PRs
   GITHUB_DEFAULT_PR_URL=https://github.com/owner/repo/pull/123
   ```

   A commit URL (`https://github.com/owner/repo/commit/<sha>`) also works.
4. **Restart the app.**
5. **Run a test analysis.**
6. **Verify GitHub PR data is included** in the normalized context.

**Notes**

- **Public PR support** works with no token (the app reads the public `.diff`).
- **Private repos** need a token; full private-repo support via the GitHub API is
  **not** implemented in this MVP (the current connector reads the public `.diff`
  endpoint). Treat private-repo support as best-effort for now.
- **No OAuth yet.**
- **No comment writing** and **no PR review posting.**

---

## 3b. External DB-backed memory (Postgres)

By default memory is stored as JSON files (`MEMORY_STORE=file`). That is great
locally, but on many hosts (especially serverless) the filesystem is ephemeral
or read-only, so file memory does **not** survive deploys or cold starts. For
durable production memory, use the external DB store.

**What it stores** — the same memory the app already keeps: user preferences /
prompt preferences, project memory (active spec summary, latest summary,
checklist statuses, blockers, decisions, next actions), and the bounded snapshot
history. Each record is saved as one JSONB document, so the schema stays tiny and
the memory model can evolve without migrations.

**Schema** — created automatically on first use (idempotent
`CREATE TABLE IF NOT EXISTS`):

```sql
user_memory (
  user_id      text primary key,
  memory_json  jsonb not null,
  updated_at   timestamptz not null default now()
);
project_memory (
  user_id      text not null,
  project_id   text not null,
  memory_json  jsonb not null,
  updated_at   timestamptz not null default now(),
  primary key (user_id, project_id)
);
```

**Provider-agnostic** — the store speaks **standard Postgres over `DATABASE_URL`**
using the `pg` driver. It uses **no** Supabase-specific SDK, and does **not** use
Supabase Auth or Supabase Storage. Supabase is simply the recommended managed
Postgres provider; Neon, RDS, Railway, or local Postgres work identically.

**Setup**

1. Provision a Postgres database. Supabase is recommended (see the
   Supabase walkthrough below); Neon, RDS, Railway, or local Postgres also work —
   anything reachable via a connection string.
2. Copy its connection string (e.g. `postgres://user:pass@host:5432/dbname`).
   Managed providers usually require SSL — use the connection string they give
   you (often with `?sslmode=require`).
3. Set env vars — **these two are the only ones DB memory needs:**

   ```env
   MEMORY_STORE=db
   DATABASE_URL=postgres://user:pass@host:5432/dbname
   ```

4. **Restart the app.** The tables are created on the first memory read/write.
5. Save memory from the UI, restart, and confirm it reloads (see verify below).

**Getting the Supabase connection string**

1. Create a project at <https://supabase.com/dashboard> (pick a region and a
   strong database password — you'll need that password in the string).
2. In the project, open **Project Settings → Database**.
3. Under **Connection string**, choose the **URI** tab. Supabase shows two kinds:
   - **Connection pooling** (host `...pooler.supabase.com`, port `6543`,
     "Session" mode) — **use this one.** It is the right choice for serverless
     and pooled environments.
   - **Direct connection** (port `5432`) — fine for a long-running server or
     local development.
4. Copy the URI. It looks like:

   ```text
   postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
   ```

5. Replace `<password>` with your database password (URL-encode any special
   characters). Supabase connections use SSL by default.
6. Put it in `.env` as `DATABASE_URL` and set `MEMORY_STORE=db`:

   ```env
   MEMORY_STORE=db
   DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
   ```

7. **Restart the app.** The `user_memory` and `project_memory` tables are created
   automatically on first use — no SQL to run by hand. You can inspect them later
   in the Supabase **Table Editor**.

> **Password with special characters?** The password lives in the URL, so any
> reserved character (`@ : / ? # & % + space`) must be **URL-encoded** (e.g. `@`
> → `%40`, `#` → `%23`). Otherwise the connection string parses incorrectly and
> the connection fails.

**Verify the connection (recommended)**

Before running the app, confirm the database and memory store actually work:

```bash
npm run check:db
```

It loads `.env`, confirms `MEMORY_STORE=db` and that `DATABASE_URL` is present
(without printing it), connects to Postgres, ensures the tables exist, then does a
real user + project memory write/read and a project-memory clear against a
namespaced test id, cleaning up after itself. Expected output:

```text
DB memory check

MEMORY_STORE: db
DATABASE_URL: present
Postgres connection: OK
Schema: OK
User memory write/read: OK
Project memory write/read: OK
Project memory clear: OK

Result: DB memory is connected and working.
```

If it fails it prints a clear, actionable reason (never the connection string),
e.g. `DATABASE_URL is missing. Set it in .env when MEMORY_STORE=db.` or
`Postgres connection failed. Check the Supabase password, host, port, and SSL
requirements`.

**Confirm memory persists across restarts (UI)**

1. `npm run ui` and open the workspace.
2. Run an analysis with a **project name** (this keys project memory), generate
   Daily Work Guidance, and **save to memory**.
3. **Stop the server**, start it again, and re-run with the **same project name**.
4. Confirm the prior progress **reloads from Postgres** as context.
5. **Clear project memory** from the UI and confirm it is gone (the row is
   deleted in Supabase).

**Notes**

- `DATABASE_URL` is read **only** when `MEMORY_STORE=db`. In any other mode it is
  ignored, and file/in-memory behavior is unchanged.
- If `MEMORY_STORE=db` and `DATABASE_URL` is missing, startup fails with a clear
  config error (rather than silently losing memory).
- The connection string / secrets are never logged.
- No ORM and no migration tool — just the `pg` driver and JSONB documents.
- **Provider-agnostic by design:** no Supabase SDK, Auth, or Storage. Migrating
  to another Postgres host later is just a new `DATABASE_URL`.

---

## 3c. Telegram bot

Telegram is a **thin command interface** over the **same product**. It does not
duplicate any business logic: it calls the same analysis workflow, the same
`MemoryStore`, and the same artifact-generation paths the UI uses. It is
**disabled** unless `TELEGRAM_BOT_TOKEN` is set.

From Telegram you can read status/memory, run analysis, generate Daily Work
Guidance / Technical Change Brief / Demo Prep / Weekly Review, explicitly save
memory, and clear project memory. Generation produces **mock/demo** output unless
the engine is in real mode (`UI_MODE=real` + `OPENAI_API_KEY`), exactly like the
UI.

### Full Telegram workflow

A typical session:

1. `/status` — see the latest saved summary, checklist, blockers, next actions.
2. `/analyze spec: <requirement> diff: <unified diff>` — run the analysis. You
   can also `/analyze` with no arguments if `GITHUB_DEFAULT_PR_URL` is configured
   (for the diff) and an active spec summary is saved in project memory (for the
   requirement).
3. `/daily` — generate Daily Work Guidance (summary, planned steps, blockers,
   decisions, next Cursor prompt). Reuses the analysis session from step 2.
4. `/technical` — generate the Technical Change Brief (executive summary,
   technical changes, files worth showing, talking points).
5. `/demo` — generate the Demo Prep Loop (demo story, walkthrough order,
   screenshot plan summary, short pitch, deck status).
6. `/weekly` — generate the Weekly Review (executive summary, progress vs spec,
   demo/video story, suggested weekly update, next-week plan).
7. `/save` (or `/save daily` / `/save weekly`) — explicitly persist the latest
   proposed memory update. **Nothing is auto-saved.**
8. `/clear` then `/clear confirm` — clear the project's memory (project memory
   only; your prompt/working preferences are never touched).

**Source strategy** — pasted `spec:` / `diff:` text is the source of truth.
Otherwise the requirement falls back to the saved **active spec summary** and the
diff falls back to `GITHUB_DEFAULT_PR_URL`. If neither a requirement nor a diff
can be resolved, the bot tells you exactly what is missing — it never invents a
diff or spec.

**Deck / exports** — `/demo` reports the deck plan and points you to the UI to
export the Markdown/PPTX deck. Binary file sending from Telegram is not enabled;
use the UI download for the deck files.

**Setup**

1. **Create a bot** — message [@BotFather](https://t.me/BotFather), send
   `/newbot`, follow the prompts.
2. **Copy the bot token** BotFather gives you. Keep it private (it is never
   logged by this app).
3. **Set env vars:**

   ```env
   TELEGRAM_BOT_TOKEN=123456:ABC-your-token
   TELEGRAM_WEBHOOK_SECRET=choose-a-long-random-string
   TELEGRAM_ALLOWED_CHAT_IDS=11111111,22222222
   TELEGRAM_DEFAULT_PROJECT=your-project-name
   TELEGRAM_WEBHOOK_URL=https://your-deployment.example.com/api/telegram
   ```

4. **Register the webhook** with Telegram (exact format):

   ```text
   https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<TELEGRAM_WEBHOOK_URL>&secret_token=<TELEGRAM_WEBHOOK_SECRET>
   ```

   Open that URL in a browser (or `curl` it). Telegram then POSTs updates to
   `POST /api/telegram`, including the secret in the
   `X-Telegram-Bot-Api-Secret-Token` header, which the app validates.
5. **Find your chat id** — message the bot, then read the numeric `chat.id` from
   `https://api.telegram.org/bot<TOKEN>/getUpdates`, and add it to
   `TELEGRAM_ALLOWED_CHAT_IDS`.
6. **Restart the app** and test `/start`, then `/status`.

**Allowed chat ids** — `TELEGRAM_ALLOWED_CHAT_IDS` is a comma/space separated
list. When it is **empty the bot is CLOSED** (it rejects every chat) so memory is
never exposed by an unconfigured deployment. Add at least one chat id to grant
access. Unauthorized chats get a short "not authorized" reply and never see any
project data.

**Commands**

| Command | What it does |
|---------|--------------|
| `/start` | Explains the bot, the default project, the engine mode, and lists commands. |
| `/help` | Lists commands with short examples. |
| `/status [project]` | Latest summary, checklist statuses, blockers, next actions. |
| `/memory [project]` | Compact snapshot (summary + counts). |
| `/next` | Next actions only. |
| `/blockers` | Open blockers/risks only. |
| `/preferences` | Your saved prompt/working preferences (read-only). |
| `/project [name]` | Show or set the active project for this chat. |
| `/analyze [project] [spec: … diff: …]` | Run/reuse the analysis. |
| `/daily` | Generate Daily Work Guidance. |
| `/technical` | Generate the Technical Change Brief. |
| `/demo` | Generate the Demo Prep Loop. |
| `/weekly` | Generate the Weekly Review. |
| `/save [daily\|weekly]` | Save the latest proposed memory update. |
| `/notion daily\|weekly\|demo\|memory` | Send the latest matching artifact (or saved memory snapshot) to the configured Notion page. Explicit only. |
| `/clear [confirm]` | Clear project memory (confirmation required). |

Project resolution: an explicit `[project]` wins, then the chat's active project
(`/project <name>`), then `TELEGRAM_DEFAULT_PROJECT`.

**Per-chat state** — the bot keeps lightweight, in-memory control state per
allowed chat (active project, last analysis session for on-demand generation,
pending save source, pending clear confirmation). This is **not** durable product
memory: Project Memory lives in the `MemoryStore`. Control state is lost on
restart, which is fine.

**Safety** — no hidden auto-save (`/save` is required), `/clear confirm` is
required to clear, unauthorized chats are rejected, an empty
`TELEGRAM_ALLOWED_CHAT_IDS` denies all, the webhook secret is validated, and the
bot token is never logged.

**Notion write-back** — `/notion daily|weekly|demo|memory` appends the latest
matching artifact (or the saved memory snapshot) to the configured Notion page.
It is **explicit only**: `/daily`, `/weekly`, and `/demo` never write to Notion
by themselves. Missing artifact or missing Notion config returns a clear message;
on success the bot replies `Sent to Notion.`

**What Telegram deliberately does NOT do (yet)** — no scheduling or background
monitoring, no inline-keyboard UI, no file uploads, no binary deck sending, no
GitHub write actions, and no multi-user auth beyond the allowed chat ids.

**Troubleshooting**

- **Bot does not reply** — confirm the webhook is registered (`setWebhook`) and
  reachable, the deployment is public, and `TELEGRAM_WEBHOOK_URL` matches the live
  URL. Check the server logs for `[telegram]` warnings.
- **Wrong secret** — the app returns `401` and sends nothing. Re-run `setWebhook`
  with the same `secret_token` you set in `TELEGRAM_WEBHOOK_SECRET`.
- **Chat not allowed** — you get "This chat is not authorized." Add your chat id
  to `TELEGRAM_ALLOWED_CHAT_IDS` and restart.
- **Missing token** — the webhook route responds `404` ("Telegram is not
  configured"); set `TELEGRAM_BOT_TOKEN` and restart.
- **Missing OpenAI key** — in `UI_MODE=real` the app requires `OPENAI_API_KEY`
  (+ `OPENAI_MODEL`) to start. Without real mode, generation commands return
  clearly-labeled **mock/demo** output.
- **Missing project / default sources** — `/analyze` (and generation) reply with
  exactly what is missing: a requirement (paste `spec:` or save an active spec
  summary) and/or a diff (paste `diff:` or set `GITHUB_DEFAULT_PR_URL`).
- **No memory yet** — `/status` says "No saved progress yet." Run `/analyze` then
  `/daily` and `/save`, or save from the UI. In production point the UI and bot at
  the same store (e.g. `MEMORY_STORE=db`).
- **No pending save** — `/save` with nothing generated replies "No pending memory
  update." Generate `/daily` or `/weekly` first.
- **Deck not sent as a file** — expected: `/demo` reports the deck plan and points
  to the UI for the Markdown/PPTX download. Binary sending is not enabled.

**Test it without a real bot** — run `npm run check:telegram`. It simulates the
full command flow with the mock engine and in-memory stores, using no Telegram
token, no webhook, and no OpenAI key.

---

## 4. How to verify

1. **Run with integrations disabled** (`SOURCE_INTEGRATIONS_ENABLED=false` or
   unset). Paste a requirement + diff and run. Confirm the **manual paste flow
   still works** and produces artifacts.
2. **Enable integrations** (`SOURCE_INTEGRATIONS_ENABLED=true`).
3. **Add the Notion page env** (`NOTION_API_KEY`, `NOTION_DEFAULT_PAGE_ID`).
4. **Add the GitHub PR env** (`GITHUB_DEFAULT_PR_URL`, optional `GITHUB_TOKEN`).
5. **Run analysis** again.
6. **Confirm `sourceSummary`** lists `manual input`, `project memory` (if any),
   `Notion`, and `GitHub` where available. The unified context is on
   `result.projectContext` (visible in the workspace **Raw JSON** debug card):

   ```jsonc
   "projectContext": {
     "sources": [ { "source": { "kind": "manual" }, ... },
                  { "source": { "kind": "notion" }, ... },
                  { "source": { "kind": "github" }, ... } ],
     "sourceSummary": "Context assembled from 4 source(s): manual input ...; Notion (...); GitHub (...)."
   }
   ```

7. **Confirm artifacts still generate** normally, and that the **Sources** panel
   lists the Notion page as supporting context for Daily/Technical/Demo/Weekly.
8. **Confirm write-back** (needs a real key + a page you can edit): generate
   Daily / Weekly / Demo, click the matching **Send … to Notion** button (or run
   Telegram `/notion weekly`), and confirm the dated section appears appended to
   the page. Generate a Memory Snapshot save, then **Send Memory Snapshot to
   Notion**.

Programmatic check (no UI): call `harness.runAnalysis({ rawDiff, requirementText,
projectId, notionPageId?, githubPrUrl? })` and inspect `result.projectContext`.

### Mock end-to-end check (no real key) — `npm run check:notion`

A single command exercises the whole Notion path with a **mock** connector, so it
needs **no real `NOTION_API_KEY`, page, or network**:

```bash
npm run check:notion
```

It verifies, and prints an `OK` line for each: connector wiring from env, the
Notion page is read, the source appears in `projectContext.sources`, the capped
connected-source context is produced and marked untrusted, Daily / Technical /
Demo / Weekly each receive that context, the write-back formatter produces valid
append content, the explicit write-back handler calls `appendToPage`, and running
an analysis performs **no auto-write**. Expected tail:

```text
Result: Notion read/write integration is wired correctly (mocked).
```

The same paths are also covered by the unit tests (`npm test`): the connector is
called on explicit write-back, missing config/artifact returns a clear error,
generation never auto-writes, and no secret is logged or returned.

### Real smoke test (needs real credentials) — `npm run check:notion:real`

Verifies the **real** `HttpNotionConnector` against a real page. Requires:

```env
SOURCE_INTEGRATIONS_ENABLED=true
NOTION_API_KEY=...            # never printed
NOTION_DEFAULT_PAGE_ID=...    # a page shared with the integration
```

**Read-only by default:**

```bash
npm run check:notion:real
```

It connects, fetches the configured page, and prints only **safe metadata**: the
page id **redacted** (last 6 chars), the page title, and the number of characters
fetched. It never appends.

**Opt in to a tiny test append** with an explicit safety flag:

```bash
NOTION_WRITE_SMOKE_TEST=true npm run check:notion:real
```

With the flag set it appends one short, dated block:

```text
Notion integration smoke test — YYYY-MM-DD HH:mm
This is a test append from Developer Work Companion.
```

`NOTION_API_KEY` (and `OPENAI_API_KEY` / `DATABASE_URL`) are scrubbed from all
output, including error messages. This check needs real credentials and is
**never run in CI**.

### UI verification checklist (real mode)

1. Start the app in real mode (`UI_MODE=real`, `SOURCE_INTEGRATIONS_ENABLED=true`,
   `NOTION_API_KEY`, `NOTION_DEFAULT_PAGE_ID`): `npm run ui`.
2. Run an analysis (paste a requirement + diff).
3. Open the **Sources** panel.
4. Confirm the **Notion** source appears as supporting context.
5. Generate **Daily Work Guidance**.
6. Confirm Daily can reference the Notion page as supporting context (source of
   truth stays the pasted requirement/diff).
7. Click **Send Daily to Notion**.
8. Confirm the success message.
9. Open the Notion page and confirm the dated section was appended.
10. Repeat for **Weekly**, **Demo**, and a saved **Memory Snapshot**.

### Telegram verification checklist

With Telegram configured (see §3c) and Notion write-back wired:

```text
/notion daily
/notion weekly
/notion demo
/notion memory
```

Confirm:

- each command requires an explicit user action (nothing writes on its own);
- a missing artifact gives a clear "generate it first" error;
- missing Notion config gives a clear "not configured" error;
- a successful command appends to the configured page;
- `/daily` and `/weekly` **do not** auto-write to Notion — only `/notion …` does.

---

## 5. Troubleshooting

- **Notion "page not found" / 404** — the page id is wrong, or the integration is
  **not shared** with the page (step 3 of Notion setup). The source is skipped
  with a warning; the run still completes on manual input.
- **Notion integration not shared with page** — open the page → **•••** →
  **Connections** → add your integration, then retry.
- **GitHub 404 / private repo** — the PR is private or the URL is wrong. Public
  PRs need no token; private repos are best-effort and may require API support
  that this MVP does not implement.
- **Missing env vars** — if `SOURCE_INTEGRATIONS_ENABLED` is not exactly `true`,
  integrations stay off. If enabled but `NOTION_API_KEY` is missing, Notion is
  skipped (a warning is recorded) and GitHub still works.
- **Invalid PR URL** — only `github.com` `…/pull/<n>` or `…/commit/<sha>` URLs are
  accepted; anything else is skipped with a warning.
- **Integrations disabled** — expected default. Manual paste + memory still work.
- **Memory file missing/corrupted** — a missing file means "no memory" (normal
  for a new project). A corrupted file surfaces a clear load error and is treated
  as no-memory rather than crashing the run.

---

## Environment variables reference

| Variable | Purpose | Default |
|----------|---------|---------|
| `SOURCE_INTEGRATIONS_ENABLED` | Master switch for Notion/GitHub sources. Must be exactly `true`. | `false` |
| `NOTION_API_KEY` | Notion internal integration secret. Enables both read context and explicit write-back. Never logged. | _(unset → Notion off)_ |
| `NOTION_DEFAULT_PAGE_ID` | Default Notion page id/URL read each run and used as the default write-back target. | _(unset)_ |
| `GITHUB_TOKEN` | Optional token (rate limits / private best-effort). | _(unset)_ |
| `GITHUB_DEFAULT_PR_URL` | Default GitHub PR/commit URL read each run. | _(unset)_ |
| `MEMORY_STORE` | `file` (durable local), `memory` (tests), or `db` (external Postgres). | `file` |
| `MEMORY_DATA_DIR` | Directory for the file memory store. | `data/memory` |
| `MEMORY_USER_ID` | Single MVP user id for memory. | `local` |
| `DATABASE_URL` | Postgres connection string. Read **only** when `MEMORY_STORE=db`. | _(unset)_ |
| `TELEGRAM_BOT_TOKEN` | BotFather token. Enables the bot when set. Never logged. | _(unset → bot off)_ |
| `TELEGRAM_WEBHOOK_SECRET` | Secret validated against Telegram's webhook header. | _(unset → not verified)_ |
| `TELEGRAM_ALLOWED_CHAT_IDS` | Allowed chat ids (comma/space separated). Empty = closed (deny-all). | _(empty → closed)_ |
| `TELEGRAM_DEFAULT_PROJECT` | Default project for commands with no argument. | _(unset)_ |
| `TELEGRAM_WEBHOOK_URL` | Public webhook URL (setup/`setWebhook` only). | _(unset)_ |

Secrets are read only from the environment. They are never hardcoded or logged.
