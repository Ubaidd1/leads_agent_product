# Backend Plan — Phase 2 and Phase 3

This plan follows Phase 1 (auth, sessions, workspaces, lead and company reads, saved leads), which is done; see [README](../README.md) and [AUDIT](AUDIT.md). Phase 2 makes the core hiring workflows real and connects the frontend. Phase 3 adds exports, scoring, ingestion, background jobs, and outside integrations.

Each section lists what to build (tables, endpoints, rules), how to test it, and when it counts as done. Items marked **DECISION** need a product answer before or during the work. They are also collected in the [open decisions](#open-decisions) table at the end.

---

## Rules that apply to everything below

These were set in Phase 1 and every new feature must follow them.

- **Workspace isolation.** Every query goes through `visible_to()` (in `app/repositories/catalog.py`) or filters on `workspace_id == ctx.workspace.id`. The workspace always comes from `RequestContext`, never from the request body. A record in another workspace returns **404**.
- **Permissions.** Check with `ctx.require(Permission.X)`. The roles are already defined in `app/core/permissions.py`: `SAVED_SEARCHES_WRITE`, `EXPORTS_CREATE`, `INTEGRATIONS_MANAGE`, `DATA_SOURCES_MANAGE`.
- **One way to filter leads.** Saved searches, alerts, exports, and analytics must all reuse `LeadFilters` and `lead_query()`. Never write a second version of the filter logic.
- **API format.** JSON fields are camelCase. Errors are always `{"error": {"code", "message", "details?"}}`. Lists are `Page<T>` with a maximum page size of 100. Sort fields come from an allowed list. Timestamps are UTC.
- **CSRF.** Every POST, PUT, PATCH, or DELETE needs the `X-CSRF-Token` header (already enforced by `get_auth_session`).
- **Migrations.** Every schema change gets its own Alembic migration. Remove the duplicate `CheckConstraint` lines that autogenerate creates. `alembic check` must report no drift.
- **Audit log.** Record sensitive changes with `services.audit.record()` in the same transaction as the change.
- **No fake data.** Never return made-up counts, statuses, or "success" for work that has not actually happened. If something is not running yet, the API says so.

---

# Phase 2 — Core hiring workflows

Planned order: 2.1 Saved searches → 2.2 Alerts → 2.3 Dashboard and analytics → 2.4 Frontend integration (can start in parallel once 2.1's endpoints exist) → 2.5 Demo seed.

No new dependencies are needed in Phase 2.

## 2.1 Saved searches

### Tables

**`saved_searches`**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `workspace_id` | FK workspaces, cascade | indexed |
| `created_by_user_id` | FK users, set null | |
| `name` | varchar(200) | unique per workspace |
| `criteria` | JSONB | validated by `SearchCriteria` (same fields as the `GET /leads` filters; see below) |
| `frequency` | enum `manual \| instant \| daily \| weekly` | |
| `is_active` | bool | "Active / Paused" in the UI |
| `notify_in_app`, `notify_email` | bool | |
| `last_run_at`, `next_run_at` | timestamptz | `next_run_at` is only meaningful once the scheduler exists (3.1) |
| `last_run_status` | enum `never \| succeeded \| failed` | |
| `last_result_count`, `last_new_count` | int, nullable | **NULL until the search has actually run.** Never 0 or a placeholder. |
| `created_at`, `updated_at` | timestamptz | |

**`saved_search_runs`**: `id`, `saved_search_id`, `workspace_id`, `trigger` (`manual | scheduled`), `status` (`queued | running | succeeded | failed`), `started_at`, `finished_at`, `result_count`, `new_count`, `error_code`, `error_message` (safe text only, no internal exception details). Index on `(saved_search_id, started_at desc)`.

**`saved_search_matches`**: `saved_search_id`, `lead_id`, `first_matched_run_id`, `first_matched_at`. Unique on `(saved_search_id, lead_id)`. This table is how a run works out which matches are new.

### `SearchCriteria` schema

This is a Pydantic model shared with the `GET /leads` query parser, so both stay identical: `q`, `serviceTypes[]`, `technologies[]`, `technologyMatch`, `intents[]`, `regions[]`, `freshnessDays`, `minScore`. A `criteriaVersion` field is stored inside the JSON so the format can change later. `to_filters()` converts it to `LeadFilters`.

### How a run works

1. Take a row lock on the saved search with `SELECT ... FOR UPDATE SKIP LOCKED`, so the same search never runs twice at once (return 409 `RUN_IN_PROGRESS` if it is locked).
2. Run `lead_query(workspace_id, criteria.to_filters())` and collect only the lead IDs. Cap this at 10,000; above that, record the run as `truncated` in the run's data.
3. Use `INSERT ... ON CONFLICT DO NOTHING RETURNING lead_id` into `saved_search_matches` to find the new matches.
4. Save the counts on the run and copy them to the saved search. Commit.
5. If there are new matches and notifications are on, create an alert (2.2).

"Run now" executes this inside the request, which is fine for the current data size. When the worker exists (3.1), "Run now" will queue a job and return `202` with the run in `queued` status.

**Scheduling is honest about its state.** Until 3.1 ships, saving `daily`, `weekly`, or `instant` is allowed, but `next_run_at` stays NULL and responses include `"scheduling": {"enabled": false}`. The UI must say "Scheduled runs not yet active" instead of showing a time.

### Endpoints

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/saved-searches` | member | Paginated. Filter `active=true\|false`. Sort `updatedAt\|name\|lastRunAt`. |
| POST | `/saved-searches` | `SAVED_SEARCHES_WRITE` | `{name, criteria, frequency, isActive, notifyInApp, notifyEmail}` → 201. A duplicate name returns 409. |
| GET | `/saved-searches/{id}` | member | Includes the latest run. |
| PATCH | `/saved-searches/{id}` | owner of the search or admin+ (**DECISION D2.1**) | Changing `criteria` clears the match history, because "new" is relative to the criteria. |
| DELETE | `/saved-searches/{id}` | same as PATCH | 204 |
| POST | `/saved-searches/{id}/duplicate` | `SAVED_SEARCHES_WRITE` | Name becomes "<name> (copy)", made unique. The copy has no run history. 201. |
| POST | `/saved-searches/{id}/run` | `SAVED_SEARCHES_WRITE` | 200 with the run (202 once the worker exists). |
| GET | `/saved-searches/{id}/runs` | member | Paginated run history. |
| GET | `/saved-searches/{id}/results` | member | `Page<LeadSummary>` of the current matches, using the stored criteria. New-since-last-view is marked by `isNew`. |
| GET | `/leads/count` | member | Same filters as `/leads`, returns `{total}`. Replaces the search builder's hard-coded "487 companies". |

The UI's summary line ("React · Node.js · USA · Score 80+") is built from `criteria` on the frontend. It is not stored.

### Tests

- Create, read, update, delete, and duplicate.
- A duplicate name returns 409.
- Criteria validation returns 422 for an unknown region, a score above 100, or extra keys.
- Counts are NULL before the first run.
- The second run reports `new_count = 0`.
- Adding a matching lead makes the next run report `new_count = 1`.
- Two runs at the same time produce one 409.
- Workspace isolation: another workspace's search returns 404 for detail, run, results, and duplicate.
- A member cannot edit an admin's search (if D2.1 is "owner-only").

## 2.2 Alerts and in-app notifications

### Tables

**`alerts`** stores the event itself, once per workspace.
`id`, `workspace_id`, `alert_type` (`saved_search_matches | company_signal | digest`), `saved_search_id` (nullable FK), `company_id` (nullable FK), `title`, `detail`, `payload` JSONB (for example `{runId, newCount, leadIds[:20]}`), `dedupe_key` (unique per workspace, for example `search:<id>:run:<runId>`), `is_demo`, `created_at`.

**`alert_recipients`** stores each user's copy of the alert, so read and deleted state is per person.
`alert_id`, `user_id`, `read_at`, `dismissed_at`. Primary key is `(alert_id, user_id)`. Index on `(user_id, dismissed_at, read_at)`.

**`notification_deliveries`** records every delivery attempt.
`id`, `alert_id`, `user_id`, `channel` (`in_app | email | slack | webhook`), `status` (`pending | sent | failed | skipped`), `attempts`, `last_attempt_at`, `sent_at`, `error_code`, `error_message`, `idempotency_key` (unique: `alert:user:channel`).

**Delivery is never faked.** An `in_app` delivery is marked `sent` only when the `alert_recipients` row is written. An `email` delivery stays `pending` until the Phase 3 worker and email provider actually send it. If email is not set up, it is marked `skipped` with `error_code=EMAIL_NOT_CONFIGURED`.

### Who receives an alert

All current members of the workspace receive it. Once preferences exist, members who turned notifications off are excluded (**DECISION D2.2**: the default is everyone; Phase 3 adds per-user preferences).

### What "pause" means

In the prototype, each alert row has an "Active / Paused" toggle. What can actually be paused is the *source* of the alert. So `PATCH /alerts/{id}` with `{paused}` turns notifications on or off for the alert's saved search (`notify_*`) and returns the new state. Alerts with no saved search cannot be paused (422). **DECISION D2.3**: confirm this, or move the pause control to the saved-search screen.

### Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/alerts` | Paginated, newest first. Filters: `unread`, `type`, `savedSearchId`. Each item includes `isRead`, `channels[]` with delivery status, and `isPaused`. |
| GET | `/alerts/unread-count` | `{count}` for the header bell. Must be cheap: a single indexed count. |
| PATCH | `/alerts/{id}` | `{read: bool}` and/or `{paused: bool}` |
| POST | `/alerts/mark-all-read` | Sets `read_at` on all of the caller's unread recipient rows in this workspace. Returns `{updated}`. |
| DELETE | `/alerts/{id}` | Hides the alert for the caller only (sets `dismissed_at`). 204. Idempotent. |

### Tests

- Read and unread state is per user: user A marking an alert read does not affect user B.
- Mark-all-read only touches the caller's rows in the current workspace.
- Deleting an alert hides it only for the caller.
- The same `dedupe_key` creates only one alert.
- With email not configured, the email delivery is `skipped` and never `sent`.
- Pause and resume change the saved search's notification settings.
- Workspace isolation for every endpoint.

## 2.3 Dashboard and analytics

### Metric definitions

Every metric is calculated in SQL from the same base query (`lead_query` plus the visibility rules), so the dashboard, analytics, and `/leads` always agree. The reporting timezone is a new column, **`workspaces.reporting_timezone`** (IANA name, default `UTC`), editable in workspace settings. Date grouping uses `date_trunc(..., ts AT TIME ZONE tz)`. The date range comes from `from` and `to` (dates in the reporting timezone; default is the last 30 days; maximum 366 days).

| Metric | Definition |
|---|---|
| Qualified leads | Open, visible leads with `score >= qualified_threshold`. **DECISION D2.4**: the threshold is a workspace setting, default 75. |
| New leads | Visible leads whose `first_seen_at` is inside the range. |
| Verified leads | Visible leads whose `verification_status` is `verified` or `high_confidence` and whose `last_verified_at` is inside the range. |
| Verified signals | Visible `hiring_signals` with `occurred_at` inside the range. |
| High-intent companies | Visible companies with `intent_level = strong` that have at least one open visible lead. |
| Average lead score | `avg(score)` over open visible leads with a score. Rounded to 1 decimal place. |
| Change vs previous period | The same metric over the window of equal length just before the range. Returns `null` when the previous value is 0 (avoids divide-by-zero). |
| Hiring velocity (chart) | New leads per week (ISO weeks in the reporting timezone), last 8 weeks, with empty weeks filled as 0 using `generate_series`. |
| Intent distribution | Visible companies with open leads, grouped by `intent_level`, including an `unknown` bucket. |
| Technology demand | `unnest(technologies)` over open visible leads in the range: count and share, top 10. |
| Industry breakdown | Distinct companies with open visible leads, grouped by `industry`: count and share. |
| Remote acceptance | Share of open leads whose `regions` include `worldwide`, `international-remote`, or `pakistan-allowed`. |
| Monitored companies | Count of visible companies. |
| Recent activity | The 10 latest visible hiring signals, with company. |
| Data freshness ("Updated X min ago") | `max(last_seen_at)` of visible leads. After 3.4, the latest successful sync run. |

**Removed instead of faked:** the sidebar's "1,284 of 2,000 credits". There is no billing model, so the frontend hides it until one exists. The dashboard's "99.2% verification rate" becomes verified leads ÷ new leads in the range.

### Endpoints

All take `from`, `to` and return `{range: {from, to, timezone}, ...}`.

- `GET /dashboard`: KPI cards with change values, an 8-week velocity series, intent distribution, the 5 top-scoring open leads, and recent activity.
- `GET /analytics/overview`: monitored companies, verified signals, average tech expansion (**DECISION D2.5**: define it, or drop the card), and remote acceptance.
- `GET /analytics/leads-over-time?interval=day|week|month`
- `GET /analytics/intent-distribution`
- `GET /analytics/technologies?limit=10`
- `GET /analytics/industries?limit=10`
- `GET /analytics/recent-activity?limit=10`

### Performance

Add indexes on `leads(first_seen_at)`, `leads(last_verified_at)`, `hiring_signals(occurred_at)`, and `leads(status, workspace_id)`. Do not load rows into Python to count them. If dashboard p95 goes above 300 ms at realistic data volume, add a 60-second cache per workspace and range (simple in-process cache first; Redis only if multiple API processes need to share it).

### Tests

- Fixed fixtures produce known numbers for every metric.
- The dashboard's qualified-leads count equals `/leads?minScore=<threshold>` → `total`.
- Timezone boundary: a lead at 23:30 UTC falls on different days in `UTC` and in `Asia/Karachi`.
- Empty weeks appear as 0.
- Change is `null` when the previous period was 0.
- Workspace isolation: workspace B's private leads never affect workspace A's numbers.
- Ranges over 366 days, or with `to` before `from`, return 422.

## 2.4 Frontend integration

Changes in `hiring-intelligence-nextjs-tailwind-only`. Page URLs must not change.

1. **Proxy:** in `next.config.mjs`, rewrite `/api/v1/:path*` to `${BACKEND_URL}/api/v1/:path*`. Set `BACKEND_URL` in `.env.local` and add a `.env.example`.
2. **API client `src/lib/api.js`:** wraps `fetch` with `credentials: "include"` and JSON, attaches `X-CSRF-Token` from the in-memory session, and turns error responses into an `ApiError(code, message, details, status)`. A 401 redirects to `/login?next=…`.
3. **Session:** add a `SessionProvider` (client) that calls `GET /auth/session` on mount and exposes `user`, `workspace`, `permissions`, and `csrfToken`. `(platform)/layout.js` shows a loading state, then redirects to login if there is no session. The header and sidebar show the real user and workspace instead of "ZoneX Dev".
4. **Remove fake state:**
   - Delete `src/app/api/*`.
   - Delete the server-owned `keys` from `src/lib/storage.js` (keep it only for UI preferences such as table vs card view).
   - Stop importing `src/data/*` in pages. The fixtures now live only in the backend seed.
5. **Wire each page:**

| Page | Change |
|---|---|
| `/login` | `POST /auth/login`. Show the "Remember me" and error states. "Forgot password?" goes to a new `/forgot-password` page. |
| `/onboarding` | Add an account step (name, email, password, workspace) that calls `POST /auth/register`, then `PUT /me/onboarding`. If already signed in, skip the account step. |
| New: `/forgot-password`, `/reset-password`, `/accept-invitation` | New routes only; no existing URL changes. |
| `/dashboard`, `/analytics` | `GET /dashboard` and `/analytics/*`, with a date-range selector. |
| `/leads` | Filters go into the URL query string, then `GET /leads`. Real pagination. "Save search" opens a name dialog and calls `POST /saved-searches`. Bookmark calls `PUT/DELETE /leads/{id}/save` and updates the row only on success. |
| `/leads/[id]`, `/companies/[id]` | Detail endpoints. Show a 404 page instead of falling back to the first fixture. |
| `/companies` | `GET /companies` with pagination. |
| `/search/new` | Debounced `GET /leads/count` for the estimate, then `POST /saved-searches`. |
| `/saved-searches`, `/saved-searches/[id]` | Saved-search endpoints. "Run now" shows the real run result. |
| `/alerts`, header bell | Alert endpoints and `unread-count`. |
| `/settings/profile`, `/settings/workspace` | `PATCH /me`, `PATCH /workspace`. Workspace fields are disabled for members (based on `permissions`). |
| `/settings/integrations`, `/settings/data-sources`, `/exports` | Read-only "Not yet available" states until Phase 3. **No connect toggles.** |

6. **Display helpers:** format enums (`strong` → "Strong"), relative time from ISO timestamps, and salary from `salaryMin`/`salaryMax`/`salaryCurrency`.
7. **Toasts:** show success only after the API call succeeds. On failure, show `ApiError.message`.

**Done when:** `grep -r "src/data\|readStorage\|writeStorage" src/app` returns only UI-preference uses; signing out and back in on a different browser shows the same saved leads, searches, and alerts; and `npm run build` passes.

## 2.5 Phase 2 demo seed

Extend `scripts/seed_demo.py`, keeping it idempotent:

- **4 saved searches.** Criteria come from the fixture summaries (for example "React · Node.js · USA · Remote · Score 80+" becomes `technologies=[React, Node.js]`, `regions=[united-states]`, `minScore=80`). Run counts start at NULL, and the seed then does one real run so the counts are true for the demo data.
- **4 alerts,** flagged `is_demo`. These are the fixture alert texts, attached to the demo workspace.

## Phase 2 exit criteria

- [ ] All endpoints above, with tests for: create/read/update/delete, permissions, isolation, validation, metric consistency, and the timezone boundary.
- [ ] No hard-coded metric, count, or success message left in the frontend.
- [ ] Every new table has a migration. `alembic check` is clean.
- [ ] README endpoint list and environment-variable docs updated.

---

# Phase 3 — Exports, scoring, ingestion, and integrations

Planned order: 3.1 Worker → 3.2 Exports → 3.3 Scoring → 3.4 Ingestion → 3.5 Scheduled searches and email → 3.6 Integrations → 3.7 Operations.

**New dependencies, each with a reason:**
- `openpyxl`: real `.xlsx` files. The current "Excel" export is HTML saved with an `.xls` name.
- `cryptography`: encrypting provider credentials (AES-GCM).
- An object-storage client (`boto3`), only if exports are stored in S3-compatible storage.

## 3.1 Background worker and scheduler

**Recommendation: a job queue stored in PostgreSQL**, using `SELECT ... FOR UPDATE SKIP LOCKED`. Postgres is already the system of record, so this adds no new infrastructure, and jobs are created in the same transaction as the data they act on. Revisit Redis/Celery or Dramatiq only if throughput needs more than about 50 jobs/second (**DECISION D3.1**).

- **`jobs` table:** `id`, `kind`, `payload` JSONB, `workspace_id` (nullable), `status` (`queued | running | succeeded | failed | dead`), `run_at`, `attempts`, `max_attempts` (default 5), `locked_by`, `locked_at`, `last_error`, `idempotency_key` (unique; nullable), `created_at`, `finished_at`. Index on `(status, run_at)`.
- **Worker** (`python -m app.tasks.worker`): picks up the oldest due job, sends it to a handler registered by `kind`, and commits.
  - On failure it reschedules with `run_at = now + min(2^attempts × 30s, 1h) ± 20% jitter`. After `max_attempts` the job is marked `dead`.
  - Jobs locked for longer than 15 minutes are treated as stuck and re-queued.
  - It shuts down cleanly on SIGTERM.
- **Scheduler loop** (in the worker, guarded by a Postgres advisory lock so only one instance schedules) runs every 60 seconds and queues:
  - due saved searches (`is_active` and `next_run_at <= now`),
  - due data-source syncs,
  - pending deliveries,
  - daily cleanup: expired sessions, reset tokens, rate-limit buckets, and expired exports.
- **Workspace scope in jobs:** handlers receive `workspace_id` in the payload and load all data through the same tenant-scoped repositories as the API. Jobs never run unscoped queries over customer data.
- **Health:** a `worker_heartbeats` table. `/ready` reports `worker: stale` if no heartbeat in the last 2 minutes (as a warning only, so the API still serves).
- **Tests:** retries and backoff, the dead-letter state, idempotency keys, two workers never taking the same job (two sessions), and stuck-job recovery.

## 3.2 Exports

**`export_jobs` table:** `id`, `workspace_id`, `requested_by_user_id`, `format` (`csv | xlsx`), `selection` (`ids | filters`), `lead_ids` uuid[] (at most 5,000), `filters` JSONB (`SearchCriteria`), `status` (`queued | running | succeeded | failed | expired`), `record_count`, `file_name`, `file_size`, `sha256`, `storage_key`, `error_code`, `created_at`, `started_at`, `finished_at`, `expires_at` (default 7 days, **DECISION D3.2**).

**Rules**
- **Which records are exported.** Both `lead_ids` and `filters` are re-resolved through `lead_query` *for the requesting workspace when the file is generated*. Any ID that is not visible to that workspace is dropped. The job records how many requested IDs were dropped and reports it as `skippedCount` in the export job response, so nothing disappears silently.
- **Size limits.** Maximum 10,000 rows per export (**DECISION D3.3**). Exports of 1,000 rows or fewer are generated during the request and come back `succeeded`. Larger ones are queued and return `202` with status `queued`. The status is set to `succeeded` only after the file is written and its hash recorded.
- **File safety.**
  - CSV: escape cells that start with `= + - @ \t \r`, to prevent formula injection when opened in a spreadsheet. UTF-8 with a BOM so Excel reads it correctly.
  - XLSX: built with `openpyxl` write-only mode.
  - Columns: the current `export.js` columns plus score version, verification status, canonical URL, and source count.
- **Storage.**
  - `ExportStorage` interface with a `LocalStorage` implementation (`storage/exports/<workspace_id>/<uuid>.<ext>`, not reachable from the web) and an `S3Storage` implementation for production.
  - Downloads always go through the API's permission check. For S3, the API returns a 302 to a pre-signed URL valid for 5 minutes.
- **Retention.** A daily job deletes files past `expires_at` and marks the jobs `expired`. Downloading an expired export returns `410 EXPORT_EXPIRED`.
- **Audit log:** `export.created` and `export.downloaded`.

**Endpoints:** `POST /exports` (`EXPORTS_CREATE`), `GET /exports` (paginated history for the workspace), `GET /exports/{id}`, `GET /exports/{id}/download`.

**Tests:**
- Export contents match the lead data, including escaping of formula characters.
- An ID from another workspace is dropped and counted.
- Downloading another workspace's export returns 404.
- An expired export returns 410.
- A large export reports `queued` and then `succeeded` only after the worker finishes.
- Requests over the row limit return 422.

## 3.3 Scoring engine

**Structure:** `app/services/scoring/` holds one module per scoring version (`v1.py`). Each version is a pure function `score(inputs: ScoreInputs, weights: Weights) -> ScoreResult(components, total, rationale, flags)`. It does no database or network access and contains no randomness, so the same inputs always give the same output.

**Component maximums** (from the UI): relevance 25, hiring intent 20, freshness 15, remote fit 10, commercial value 10, company activity 10, seniority 5, data quality 5. The maximums can be changed per version. Components are rounded with half-up rounding, and the total is the sum of the rounded components (always 100 or less).

**DECISION D3.4 (blocking): global score or per-workspace score.** "Relevance" and "remote fit" depend on what each workspace is looking for (its onboarding preferences). The choices are:

- **(a)** Split the score: a global part (intent, freshness, activity, data quality, seniority, commercial value) stored on `leads`, plus a workspace-specific part (relevance, remote fit) calculated when the query runs.
- **(b)** A `lead_workspace_scores` table with the full score for every lead and workspace pair.

**Recommendation: (a).** Option (b) grows as leads × workspaces.

**Draft formulas.** These are **proposals only, not to be built until approved (D3.5)**. Each one is written as the fraction of the component's maximum it earns.

| Component | Draft formula |
|---|---|
| Freshness | `max(0, 1 − age_days / 30)` |
| Hiring intent | Strong = 1, Medium = 0.6, Low = 0.25, unknown = 0 (and flagged) |
| Company activity | `min(1, open_roles / 10) × 0.5 + clamp(velocity_pct / 50) × 0.5` |
| Relevance | Overlap between the lead's technologies and the workspace's technologies (Jaccard) × 0.7, plus 0.3 if the service type matches |
| Remote fit | 1 if the lead's regions include one of the workspace's regions or `worldwide`, otherwise 0 |
| Seniority | Lead/Principal = 1, Senior = 0.8, Mid = 0.5, other = 0.2 |
| Commercial value | `clamp(salary_max_usd / 180k)`, where currency conversion uses a fixed, versioned rate table |
| Data quality | `0.5 × sources ≥ 2 + 0.25 × has salary + 0.25 × verified within 7 days` |

Any missing input scores 0 for that component and adds a flag (for example `missing_salary`). The rationale text is built only from the component values and flags.

**Storing scores:** each calculation adds a `lead_scores` row (version, components, inputs snapshot, rationale) and copies the total to `leads.score` and `leads.score_version`. A `recompute_scores` job re-scores everything in batches of 1,000 when the version changes.

**Tests:**
- Boundary cases: age 0, 30, and 31 days; empty technology lists; zero salary.
- The total is always between 0 and 100.
- Running twice gives the same result.
- Missing inputs produce flags.
- A version change triggers a recompute that leaves the old score rows in place.

## 3.4 Data sources and ingestion

**Only use sources we are allowed to use.** Order of work:

1. Customer CSV import (the customer owns the data).
2. Public job-board APIs from applicant-tracking systems (Greenhouse, Lever, Ashby). These are published for showing a company's own jobs; check each provider's terms and record the evidence.
3. Licensed partner feeds, under a signed agreement.
4. Company careers pages, only through structured feeds or schema.org `JobPosting` data, respecting `robots.txt`, with no bypassing of logins, CAPTCHAs, or rate limits.

**No source can be enabled without `permission_status ∈ {permitted, licensed}`** and recorded evidence.

**Tables**

- **`data_sources`:** `id`, `workspace_id` (NULL = shared catalogue; only platform staff can create these, **DECISION D3.6**), `kind`, `name`, `config` JSONB (validated for each kind), `permission_status` (`pending_review | permitted | licensed | revoked`), `permission_evidence` JSONB (terms URL, licence reference, reviewed by, reviewed at), `enabled`, `sync_frequency`, `credentials_encrypted`, `last_success_at`, `last_error_code`, `consecutive_failures`.
- **`sync_runs`:** `id`, `data_source_id`, `status`, `started_at`, `finished_at`, `fetched`, `created`, `updated`, `unchanged`, `closed`, `failed`, `error_code`, `error_message`.

**How a sync works**
- **Adapter interface:** `fetch(config, credentials, since) -> Iterator[RawPosting]` then `normalize(RawPosting) -> NormalizedPosting` (title, company domain/name, location → `regions`, technologies from a controlled vocabulary, salary, posted date, source URL, source record ID).
- **Deduplication:**
  - First match `lead_sources(source_type, source_record_id)`.
  - Otherwise match on company domain + normalized title + main region within 30 days. This adds a source to an existing lead rather than creating a duplicate.
  - Companies are matched by domain.
- **Lifecycle:**
  - `first_seen_at` and `last_seen_at` are set on each source and lead.
  - A lead not seen in 3 consecutive successful syncs of every one of its sources is marked `closed`, and a `role_closed` signal is recorded.
- **Hiring signals created:** `new_role`, `role_closed`, `role_reopened`, and `velocity_change` (when weekly new roles change by 30% or more against a 4-week average). Company metrics (`open_roles_count`, `hiring_velocity_pct`, `intent_level`) are then **calculated** from leads, replacing the seeded "reported" values.
- **Failure handling:**
  - Retries with backoff for each request.
  - After 5 consecutive failed syncs the source is disabled automatically and admins are alerted.
  - Errors are logged without credentials or response bodies.

**CSV import**
1. `POST /data-sources/csv-import` (multipart, 10 MB / 20,000 rows maximum) checks the file and returns a preview with errors for each row.
2. `POST /data-sources/csv-import/{id}/commit` queues the import.
3. Imported rows are private to the workspace.

**Endpoints** (`DATA_SOURCES_MANAGE` for writes):
- `GET /data-sources`
- `POST /data-sources`
- `PATCH /data-sources/{id}`
- `POST /data-sources/{id}/sync` (202)
- `GET /data-sources/{id}/runs`
- CSV import endpoints (above)

**Tests:**
- Each adapter's parsing, checked against recorded sample responses (no live network in tests).
- Deduplication: one posting arriving from two sources becomes one lead with two sources.
- Lifecycle: leads are closed and reopened correctly.
- A source without permission cannot be enabled.
- CSV rows that fail validation are reported.
- An import only affects the importing workspace.

## 3.5 Scheduled searches and notification delivery

- **Scheduler:** after each run, set `next_run_at`:
  - `daily` at 08:00 and `weekly` on Monday 08:00, both in the workspace's reporting timezone;
  - `instant` runs right after any sync that adds leads matching the search.
  - Turn `scheduling.enabled` on only once this is live.
- **Email:** add an `EmailBackend` implementation for the chosen provider (**DECISION D3.7**: Postmark, SES, or SendGrid), called over HTTPS with `httpx`.
  - Messages use the provider's idempotency key where it has one, otherwise our `idempotency_key`.
  - Templates live in `app/templates/email/` (plain text plus HTML) for password reset, invitations, alerts, and the daily/weekly digest.
  - Bounces and complaints arrive by webhook (signature checked) and mark the address as not deliverable.
- **Delivery job:** takes `pending` deliveries and retries with backoff, recording each attempt.
  - Permanent errors (4xx, hard bounce) are marked `failed` right away.
  - `sent` is set only when the provider confirms it accepted the message.
- **Per-user notification preferences:** a `notification_preferences` table (per user and workspace: channels on/off, digest frequency). Every email includes a one-click unsubscribe link with a signed token.
- **Tests:** retry and backoff, idempotent re-sending, preferences are respected, and no `sent` status after a provider error.

## 3.6 Provider integrations

**Shared structure for every provider**
- **`integrations` table:** `id`, `workspace_id`, `provider`, `status` (`connected | error | revoked`; no row means not connected), `scopes[]`, `external_account_id`, `credentials_encrypted`, `connected_by_user_id`, `connected_at`, `last_success_at`, `last_error_code`, `settings` JSONB (field mapping, which events are on). Unique on `(workspace_id, provider)`.
- **Credential encryption:** AES-256-GCM via `cryptography`. Keys come from `INTEGRATION_KEYS` (key ID → key; KMS in production). Each encrypted value stores the key ID it used, so keys can be rotated. Credentials are never returned by the API or written to logs.
- **OAuth:** a `state` value stored server-side and tied to the session, PKCE where the provider supports it, a fixed callback URL, and tokens refreshed automatically before they expire.
- **Outgoing events:** `integration_events` table (`id`, `integration_id`, `event_type`, `payload`, `idempotency_key`, `status`, `attempts`, `last_error`, `external_id`). Events are created in the same transaction as the change that causes them, then sent by the worker. External IDs are saved so repeat sends update instead of duplicating.
- **Disconnect:** revoke the token with the provider (where it supports this), delete the stored credentials, set `revoked`, and write an audit entry. If the provider has already revoked access (401 on refresh), set `error` and alert admins.
- **Endpoints** (`INTEGRATIONS_MANAGE`):
  - `GET /integrations` lists the real status of each provider.
  - `POST /integrations/{provider}/connect` returns the provider's sign-in URL.
  - `GET /integrations/{provider}/callback`
  - `PATCH /integrations/{provider}` (field mapping and events)
  - `POST /integrations/{provider}/test`
  - `DELETE /integrations/{provider}`
  - `GET /integrations/{provider}/events`

**Per-provider plan.** Scopes are a starting point; **re-check each against the provider's current documentation when implementing.**

| Provider | Auth | Least-privilege scopes | What is sent / mapping | Events | Notes |
|---|---|---|---|---|---|
| Webhook (build first) | Customer URL plus signing secret we generate | — | Lead/alert JSON, versioned `schemaVersion` | `lead.saved`, `alert.created`, `export.completed` | HMAC-SHA256 of `timestamp.body` sent as `X-HI-Signature` and `X-HI-Timestamp`. HTTPS URLs only. **Block private and link-local IPs (SSRF), checked again after DNS lookup.** 10 s timeout, 5 retries. |
| Slack | OAuth v2 | `chat:write`, `channels:read` (or `incoming-webhook`) | Alert message with lead links | `alert.created` | Incoming requests checked with the Slack signing secret and a 5-minute timestamp window. |
| HubSpot | OAuth 2 | `crm.objects.companies.write`, `crm.objects.contacts.write` (deals only if needed), `oauth` | Company by domain; optional deal. Field mapping is configurable. | `lead.saved` (or a manual "push") | Upsert by domain. Store the HubSpot company ID. Respect rate-limit headers. Check v3 request signatures on webhooks. |
| Salesforce | OAuth 2 web server flow plus refresh token | `api`, `refresh_token` | Account by domain; optional Opportunity or Lead | `lead.saved` | Store the instance URL. Upsert using an external ID field. Handle sandbox and production logins. |
| Pipedrive | OAuth 2 | Deals and organizations write only | Organization plus deal | `lead.saved` | Store the company domain used by the API. |
| Zapier | API key per workspace plus REST hooks | — | Same payload as the webhook | Subscribe and unsubscribe endpoints | Publishing the Zapier app is a separate step outside this repo. |

Until a provider's full flow is built and tested, `GET /integrations` reports it as `available: false`. The UI must not show a working Connect button for it.

**Tests for every provider:** check outgoing signatures and incoming signature checks against known test values; with a mocked HTTP client, check the OAuth state is validated, token refresh works, a repeated event is sent only once, disconnect deletes credentials, and other workspaces cannot see the integration.

## 3.7 Operations and hardening

- **Cleanup jobs:** sessions more than 30 days past expiry, used or expired reset and invitation tokens, rate-limit buckets older than 1 day, expired exports, and audit events older than the retention period (**DECISION D3.8**, default 1 year).
- **Monitoring:**
  - Optional Sentry: `sentry-sdk` is already installed but not wired up. Turn it on via `SENTRY_DSN` with personal data removed before sending.
  - Prometheus metrics for request latency, job queue depth, and delivery failures (use `prometheus-client` only if the deployment platform has no built-in metrics).
- **Load test** the dashboard, `/leads`, and exports with production-sized data (for example 1 million leads and 100 workspaces). Use `EXPLAIN ANALYZE` to find missing indexes, and consider `pg_trgm` GIN indexes for the `q` text search.
- **Security review:** dependency audit (`pip-audit`), SSRF review of webhook and ingestion fetching, upload limits, and a test with a production-like configuration (`ENVIRONMENT=production` must refuse to start with insecure settings).
- **Backup and restore drill**, following the procedure in the README.

## Phase 3 exit criteria

- [ ] Worker and scheduler running in production. Scheduled searches active, and `scheduling.enabled` is true.
- [ ] Exports produce real CSV and XLSX files with permission-checked, expiring downloads.
- [ ] Scoring v1 approved, implemented, recomputed, and documented. No `demo-fixture` scores outside demo workspaces.
- [ ] At least the CSV import and one ATS adapter live, with permission evidence recorded.
- [ ] Email provider live. Production configuration starts up.
- [ ] Each integration marked available has passed its own tests. All others are reported as not available.
- [ ] Cleanup jobs, monitoring, a load test, and a restore drill completed.

---

## Open decisions

| ID | Decision | Default if no answer | Blocks |
|---|---|---|---|
| D1 (carried over) | Saved leads shared across the workspace, or per user? | Shared | — |
| D2.1 | Can members edit or delete other members' saved searches? | Owner of the search plus admins only | 2.1 |
| D2.2 | Who receives alerts? | All workspace members | 2.2 |
| D2.3 | Does "pause" on an alert pause its saved search's notifications? | Yes | 2.2 |
| D2.4 | Score threshold for a "qualified" lead | 75, set per workspace | 2.3 |
| D2.5 | Definition of "Average Tech Expansion", or drop the card | Drop the card | 2.3 |
| D3.1 | Job queue technology | Postgres `SKIP LOCKED` | 3.1 |
| D3.2 | How long export files are kept | 7 days | 3.2 |
| D3.3 | Maximum export size | 10,000 rows | 3.2 |
| D3.4 | Global score vs per-workspace score | Split model (a) | 3.3 |
| D3.5 | Approval of every scoring formula | **None — blocking** | 3.3 |
| D3.6 | Who can add sources to the shared catalogue | Platform staff only | 3.4 |
| D3.7 | Email provider | — (blocking for production) | 3.5 |
| D3.8 | How long audit logs are kept | 1 year | 3.7 |
| — | Self-service registration in production | Undecided (`ALLOW_REGISTRATION`) | Launch |
