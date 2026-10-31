# Project Status — Backend and Frontend

Snapshot of what is built in both apps and what is still to do. Updated 2026-11-01. Plans: [BACKEND_PHASES_2_3.md](BACKEND_PHASES_2_3.md), `../../frontend/FE_phase_2_3.md`. Audit and decision log: [INTEGRATION_AUDIT.md](INTEGRATION_AUDIT.md).

| Area | Phase 1 (foundation) | Phase 2 (core workflows) | Phase 3 (exports, scoring, ingestion, integrations) |
|---|---|---|---|
| Backend | ✅ Done | ✅ Done | 🟡 Job queue/worker and exports done; the rest not started |
| Frontend | ✅ Connected to the API | ✅ Connected to the API | 🟡 Exports connected; integrations and data sources show honest "not available" states |

The frontend calls FastAPI through a same-origin Next.js proxy (`/api/v1/* → BACKEND_URL`). No fixtures, mock API routes, or business data in `localStorage` remain.

**Verified 2026-11-01:** backend `pytest` → 132 passed; `ruff check` and `ruff format --check` clean; `alembic check` reports no drift; migrations round-trip down and up. Frontend `npm run build` passes. A live run (API + worker + `next start`) confirmed login, cookie session, CSRF rejection and acceptance, leads/count, saved searches, dashboard, logout, and an XLSX export download, all through the proxy. The frontend has no automated tests yet, and pages were not checked in a real browser.

---

## Backend

### Done

**Phase 1:** auth and sessions, CSRF, rate limits, profile, onboarding, workspaces, members, invitations, leads and companies, saved leads, audit log, health checks. Unchanged except that `GET /leads` now validates through the shared `SearchCriteria` schema.

**Phase 2**
- **Saved searches:** tables `saved_searches`, `saved_search_runs`, `saved_search_matches`; CRUD, duplicate, run, run history, live results with `isNew`; `GET /leads/count`. A run takes a `SKIP LOCKED` row lock (409 `RUN_IN_PROGRESS`), caps at 10,000 matches, and records new matches with `INSERT … ON CONFLICT DO NOTHING`. Counts are NULL until a real run.
- **Alerts:** tables `alerts`, `alert_recipients`, `notification_deliveries`. Each member has their own read and dismissed state; alerts are deduplicated per workspace; email is recorded as `skipped` while no provider exists. "Pause" is stored as `saved_searches.notifications_paused`, so channel choices survive a pause and resume (a small refinement of the plan's D2.3 wording).
- **Dashboard and analytics:** `GET /dashboard` and 8 `/analytics/*` endpoints, all SQL aggregates over the same scope as `/leads`. Dates are grouped in `workspaces.reporting_timezone`; `workspaces.qualified_threshold` sets "qualified". Change vs the previous period is shown only for flow metrics (new leads, verified leads, signals) and is null when the previous value is 0. "Average Tech Expansion" was dropped (D2.5).
- **Demo seed:** 4 saved searches, each run once for real, and 4 demo alerts.

**Phase 3 (partial)**
- **Job queue and worker** (`app/tasks/`): `jobs` table claimed with `FOR UPDATE SKIP LOCKED`, idempotency keys, backoff of min(2^n × 30 s, 1 h) ± 20 %, dead-lettering, recovery of jobs stuck more than 15 minutes, clean shutdown on SIGTERM, `worker_heartbeats` with a warning in `/ready`, and an advisory-locked scheduler that queues the daily cleanup (expired exports, old sessions and reset tokens, rate-limit buckets).
- **Exports:** `export_jobs` table; CSV (UTF-8 BOM, formula-injection escaping) and real XLSX (`openpyxl`). Rows are re-resolved through `lead_query` for the requesting workspace at generation time, and IDs that are no longer visible are counted as `skippedCount`. Up to 1,000 rows are generated in the request; larger exports go to the worker; more than 10,000 rows → 422. Files expire after 7 days (410 afterwards). Downloads are permission-checked, and every create and download is audited.

**Migrations:** `phase_1_foundation` → `phase_2_saved_searches_and_alerts` → `phase_2_workspace_reporting` (also converts legacy `default_geography` labels to region slugs) → `phase_3_jobs_and_exports`.

### Not done yet (Phase 3)

| Item | Status |
|---|---|
| Workflow orchestration records (`workflow_executions`, steps, user-visible progress) | Not started; will sit on top of `jobs` |
| Source registry, CSV import, ATS adapters (Greenhouse, Lever, Ashby), raw evidence | Not started; needs **SRC-1** for live sources (CSV import does not) |
| Normalization, deduplication, company resolution | Not started |
| AI extraction (provider-neutral adapter) and embeddings | Not started; needs **AI-1** and **AI-2** |
| Scoring engine v1 | **Blocked on D3.5** (formula approval), plus D3.4 |
| Freshness verification | Not started |
| Scheduled saved searches (`scheduling.enabled`) | Not started (the scheduler loop exists) |
| Email provider and delivery jobs | **Blocked on D3.7** |
| Integrations (webhook first, then Slack and CRMs), credential encryption, SSRF guard | Not started |
| Sentry, metrics, load test, restore drill | Not started |

---

## Frontend

### Done
- **API layer:** `src/lib/api/*` (cookies, in-memory CSRF token, `ApiError`, 401 → `/login?next=…`, timeouts and cancellation), `SessionProvider`, `AuthGate` on every platform route, `useApi` hook, shared Skeleton, EmptyState and ErrorState components.
- **Auth:** real login with "remember me" and expired-session notice; registration in onboarding plus saved preferences; forgot and reset password; accept invitation; logout; workspace switcher; real user and workspace in the header and sidebar.
- **Leads:** every filter, sort and page in the URL; server pagination; optimistic save and unsave with rollback; card view; "Save search" modal; export of the current filters. Lead detail shows real sources with links, the timeline, an honest score breakdown (version, time, and a demo label), and a 404 state.
- **Companies:** server search, intent filter, sort, pagination; detail with real activity, roles and signals, and a 404 state. Header search goes through the API with debounce and cancellation; ⌘K works.
- **Search builder:** shared criteria form, live debounced match count, save, and search.
- **Saved searches:** list with real counts, run, duplicate, pause, delete with confirmation; detail with edit form, live results with "New" badges, and run history; note that scheduled runs are not active.
- **Alerts:** list with unread filter, read and unread, mark all read, pause and resume, dismiss (optimistic with rollback), per-channel delivery status; the header bell shows the real unread count and polls.
- **Dashboard and analytics:** API data, 7/30/90-day range, velocity, intent, top leads, signals, technologies, industries, seniority and score bands.
- **Exports:** server export modal (status, polling, automatic download, skipped count) and an export history page.
- **Settings:** profile (email change needs the current password) and password change; workspace defaults, reporting timezone and qualified threshold (read-only for members); members (role change, remove, leave); invitations.
- **Removed:** `src/data/*`, `src/app/api/*`, `src/lib/export.js`, demo credentials, and all fake success toasts.

### Not done yet
- Automated tests (Vitest for the API client and helpers, Playwright for the main flows); none exist yet.
- Data sources and integrations screens on real APIs (they currently state "Not configured" / "Coming soon").
- Workflow progress view, score explanations from the engine, and provenance drill-down, once the backend provides them.

---

## Local environment notes
- This workspace uses its own UTF-8 databases, `leads_agent` and `leads_agent_test`, so its migrations do not break `~/Desktop/Project/hiring-intelligence-backend`, which still uses `hiring_intelligence*`. The previous `.env` is saved as `.env.backup-shared-db` (git-ignored).
- Use `backend/.venv`. The copied `backend/env` points at the original repo's interpreter and lacks `openpyxl`.

## Next steps
1. Decisions: D3.5 (scoring formulas), D3.4 (score model), D3.7 (email provider), AI-1/AI-2 (model and embedding provider, pgvector), SRC-1 (which live sources, with permission evidence).
2. Without waiting: frontend test setup, source registry plus CSV import with normalization, deduplication and company resolution, workflow execution records, webhook integration.
