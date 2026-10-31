# Integration Audit — 2026-11-01

Audit of both repositories before Phase 2/3 and frontend integration work. Earlier audit: [AUDIT.md](AUDIT.md) (2026-10-21). Plans: [BACKEND_PHASES_2_3.md](BACKEND_PHASES_2_3.md), `../frontend/FE_phase_2_3.md`, and `Remote_Hiring_Complete_Agentic_System_Documentation.pdf` (a proposed design; it says itself that no repository was inspected).

Legend: ✅ implemented and verified · 🟡 partial · ❌ not implemented · ❓ waiting on a decision.

## A. Backend (`backend/`)

**Verified on 2026-11-01:** `pytest` → **84 passed** (PROJECT_STATUS.md says 63; the extra count comes from parametrized cases). `ruff check .` clean. Dev DB at the head revision `323ff713b5be`.

| Area | State | Where |
|---|---|---|
| Auth: register, login, logout, session, switch workspace, password reset, invitation accept | ✅ | `api/v1/endpoints/auth.py`, `services/auth.py` |
| Cookie sessions (idle + absolute timeout, remember me), CSRF synchroniser token, Origin check, Argon2, DB-backed rate limits | ✅ | `api/deps.py`, `main.py`, `services/rate_limit.py` |
| Profile, password change, onboarding prefs, workspace list | ✅ | `me.py` |
| Workspace settings, members, roles, invitations | ✅ | `workspace.py`, `core/permissions.py` |
| Leads list/detail with filters, sort, pagination; save/unsave; saved leads | ✅ | `leads.py`, `repositories/catalog.py` (`LeadFilters`, `lead_query`, `visible_to`) |
| Companies list/detail (UUID or slug) | ✅ | `companies.py` |
| Tenancy: shared catalogue (`workspace_id IS NULL`) + private rows; cross-workspace → 404 | ✅ | `visible_to()` everywhere |
| Audit events, JSON logs, request IDs, security headers, `/health`, `/ready` | ✅ | |
| Email | 🟡 console adapter only | `integrations/email.py` |
| Scores | 🟡 table exists, only `demo-fixture` rows from the seed; no engine | `models/lead.py::LeadScore` |
| Saved searches, alerts, dashboard, analytics, `/leads/count` | ❌ | — |
| Worker, scheduler, exports, scoring engine, sources, ingestion, AI extraction, embeddings, integrations | ❌ | `app/tasks/` is empty |

**Tables (15):** users, user_preferences, auth_sessions, password_reset_tokens, workspaces, workspace_memberships, workspace_invitations, companies, leads, lead_sources, lead_scores, hiring_signals, saved_leads, audit_events, rate_limit_buckets.

**Reusable for the agentic pipeline:** `leads` is already the canonical opportunity; `lead_sources` is already the many-sources-per-lead provenance table with a unique `(source_type, source_record_id)` key; `lead_scores` is already versioned; `hiring_signals` already holds dated company events. The PDF's `Job`, `JobSource`, `LeadScore` and `CompanySignal` entities map onto these, so they should be extended rather than duplicated.

## B. Frontend (`frontend/`)

Next.js 15 App Router, React 19, Tailwind 3, plain JS. No data-fetching library, no tests, no `.env`. `node_modules` is not installed in this copy.

| Item | Finding |
|---|---|
| API calls | **None.** No `fetch()` anywhere. |
| Fixtures | `src/data/*` imported by 12 files: dashboard, leads, lead detail, companies, company detail, saved searches (list + detail), search builder, alerts, exports, Header, and all 6 `src/app/api/*` handlers. |
| localStorage | `src/lib/storage.js` keys session, savedLeads, savedSearches, alerts, exports, profile, workspace, onboarding, integrations. Used by login, onboarding, leads, search builder, saved searches, alerts, profile, workspace, Header. |
| `src/app/api/*` | 6 route handlers returning fixtures; no page calls them. `POST /api/exports` always says `completed`. |
| Auth | Hard-coded `demo@hiringintel.ai` / `demo123`; no route protection; "ZoneX Dev" hard-coded in Header and Sidebar. |
| Fake success | Save search (leads), Save lead (detail), Run (saved searches), Connect/Disconnect (integrations), Profile/Workspace save (localStorage only), export history Download (re-exports all fixtures). |
| Hard-coded metrics | Dashboard cards/velocity/intent/recent signals, analytics cards and bars, sidebar "1,284 of 2,000 credits", header "Updated 4 min ago", search builder "487 companies". |
| Detail fallbacks | Lead and company detail fall back to the first fixture on an unknown id instead of a 404. |
| Display shape | Fixtures use display strings (`"Strong"`, `salaryRange`, `freshness: "2 days ago"`); the API returns enums and ISO timestamps, so display helpers are needed. |

## C. Reconciliation

**Agreement.** The backend plan and the PDF agree on every core principle: tenant scope from the session, one shared lead query, permitted sources only, deterministic versioned scoring, no fabricated data, honest job states.

**Differences and gaps**

| Topic | Backend plan | PDF | Resolution |
|---|---|---|---|
| Queue | Postgres `SKIP LOCKED` (D3.1) | Redis/Celery or Postgres | Postgres: no new infrastructure, jobs commit with their data. |
| Orchestration | `jobs` table only | `workflow_executions` + `workflow_steps`, user-triggered `POST /workflows` | Add workflow tables on top of `jobs` in Phase 3; a workflow is a sequence of stage jobs. |
| AI extraction, embeddings, confidence routing, review queue | Not in plan | Specified | Phase 3 additions; need model/provider decisions (below). |
| Freshness verification | Implied by sync lifecycle (closed after 3 missed syncs) | Separate verification stage with active/closed/stale/unverifiable | Extend lifecycle with a verification record. |
| Raw evidence | Not in plan | `RawSourceRecord` with payload hash | New table in Phase 3. |
| Score storage | `lead_scores` + `leads.score`, split global/workspace model (D3.4) | Per-lead components + rationale | Same; need D3.4/D3.5. |

**Security gaps found:** none in Phase 1 code. Items to build: credential encryption, SSRF guard for webhooks/ingestion, webhook signatures, worker tenant scoping — all Phase 3.

**Environment risk (important):** this workspace's `backend/.env` points at the **same** `hiring_intelligence` and `hiring_intelligence_test` databases as `~/Desktop/Project/hiring-intelligence-backend`. Once this copy adds migrations, the original repo's test run (`downgrade base`) would fail on unknown revisions, and vice versa. Phase 2 work therefore uses separate databases (see README).

Also, `backend/env` is a copied virtualenv whose scripts point at the original repo's interpreter. It works for the current dependencies; new Phase 3 dependencies should go into a fresh venv.

### Decisions

| ID | Decision | Default used | Blocks |
|---|---|---|---|
| D1 | Saved leads shared or per user | Shared (as built) | — |
| D2.1 | Who may edit others' saved searches | Owner + admins | — (default applied) |
| D2.2 | Alert recipients | All members | — (default applied) |
| D2.3 | Alert "pause" pauses the saved search's notifications | Yes | — (default applied) |
| D2.4 | Qualified-lead threshold | 75 per workspace | — (default applied) |
| D2.5 | "Average Tech Expansion" card | Dropped | — (default applied) |
| D3.1 | Queue | Postgres | — (default applied) |
| D3.2 / D3.3 | Export retention / size | 7 days / 10,000 rows | — (default applied) |
| D3.4 | Global vs per-workspace score | Split model (a) | ❓ confirm |
| **D3.5** | **Scoring formulas** | **None — blocking** | Scoring engine |
| **D3.7** | **Email provider** (Postmark / SES / SendGrid) | None | Production email |
| **AI-1** | **LLM provider + model for extraction** and API key availability | None | AI extraction |
| **AI-2** | **Embedding provider/model**; enable `pgvector` on Postgres? | None | Semantic matching |
| **SRC-1** | **Which real sources** (ATS boards to enable) with permission evidence | CSV import only | Live ingestion |
| REV-1 | Manual review: staffed queue or explicit `review_required` state | Explicit state | — |

## D. Execution plan

Order follows the master prompt §14. Each step ends with tests and a status update.

1. **Frontend API client + session** — `src/lib/api/*` (client with CSRF, `ApiError`, 401 redirect, timeout/abort), `SessionProvider`, protected `(platform)` layout, Next.js rewrite `/api/v1 → BACKEND_URL`, `.env.example`. Real login, logout, register (onboarding), forgot/reset password, accept invitation, profile, workspace, members/invitations, workspace switcher.
2. **Leads and companies on the API** — URL-synced filters, server pagination and sorting, save/unsave, detail pages with 404, header search, shared Skeleton/EmptyState/ErrorState. Delete `src/app/api/*`, `src/data/*` imports, business keys in `storage.js`.
3. **Backend 2.1–2.3** — migrations + endpoints + tests for saved searches/runs/matches, `/leads/count`, alerts/recipients/deliveries, `reporting_timezone`, `qualified_threshold`, dashboard and analytics.
4. **Frontend Phase 2** — search builder, saved searches, alerts + bell, dashboard, analytics; honest "not yet available" states for exports, integrations and data sources.
5. **Phase 2 seed**, docs, status update.
6. **Phase 3** — worker/scheduler and workflow tables → exports (CSV/XLSX) → source registry + CSV import + one ATS adapter with recorded fixtures → normalization/dedup/company resolution → AI adapter (provider-neutral, mocked in tests) → embeddings (keyword fallback) → intent aggregation → scoring (after D3.5) → freshness verification → scheduled searches + delivery → webhook integration → hardening.

Testing: backend pytest for every endpoint (CRUD, permissions, isolation, validation); frontend Vitest for the API client and helpers; external providers always mocked.
