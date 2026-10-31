# Project Status — Backend and Frontend

Snapshot of what is built today in both repos, and what is still to do. Plans: [BACKEND_PHASES_2_3.md](BACKEND_PHASES_2_3.md) (backend) and `../hiring-intelligence-nextjs-tailwind-only/FE_phase_2_3.md` (frontend).

| Area | Phase 1 (foundation) | Phase 2 (core workflows) | Phase 3 (exports, scoring, ingestion, integrations) |
|---|---|---|---|
| Backend | ✅ Done | ❌ Not started | ❌ Not started |
| Frontend | 🟡 UI built, runs on fixtures | ❌ Not connected to the API | ❌ Not started |

The two apps are **not connected yet**. The frontend never calls the FastAPI backend.

---

## Backend — `hiring-intelligence-backend`

**Stack:** Python 3.11, FastAPI, PostgreSQL, SQLAlchemy 2.1, Alembic, Pydantic v2, Argon2, Pytest, Ruff.

### Done (Phase 1)

**Authentication and sessions** (`app/api/v1/endpoints/auth.py`)
- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`
- `GET /auth/session`, `PUT /auth/session/workspace` (switch workspace)
- `POST /auth/password-reset/request`, `POST /auth/password-reset/confirm`
- `POST /auth/invitations/accept`
- Cookie sessions with idle and absolute timeouts and "remember me"; CSRF token on every write; Argon2 password hashing; rate limiting on auth endpoints.

**Profile** (`me.py`)
- `GET/PATCH /me`, `POST /me/password`
- `GET/PUT /me/onboarding`
- `GET /me/workspaces`

**Workspace** (`workspace.py`)
- `GET/PATCH /workspace`
- Members: list, change role, remove
- Invitations: list, create, revoke
- Roles and permissions in `app/core/permissions.py`

**Leads and companies** (`leads.py`, `companies.py`)
- `GET /leads` with filters, sorting and pagination; `GET /leads/{id}`
- Saved leads: `PUT/DELETE /leads/{id}/save`, `GET /saved-leads`
- `GET /companies`, `GET /companies/{id}`
- Workspace isolation: records in another workspace return 404.

**Platform**
- `/health` and `/ready`; request ID, JSON logging, security headers, origin check, CORS
- Standard error format `{"error": {"code", "message"}}`; camelCase JSON; `Page<T>` lists
- Audit events table and service
- Email adapter: console only (logs the message, does not send)

**Database:** one Alembic migration (`phase_1_foundation`) with 15 tables: `users`, `user_preferences`, `auth_sessions`, `password_reset_tokens`, `workspaces`, `workspace_memberships`, `workspace_invitations`, `companies`, `leads`, `lead_sources`, `lead_scores`, `hiring_signals`, `saved_leads`, `audit_events`, `rate_limit_buckets`.

**Demo data:** `python -m scripts.seed_demo` (idempotent).

**Tests:** 63 tests: auth 19, leads 14, workspace 11, tenancy 7, me 5, security 4, health 3.

### Not done yet

**Phase 2**
- Saved searches (tables, CRUD, run)
- Alerts and in-app notifications
- Dashboard and analytics endpoints
- Phase 2 demo seed

**Phase 3**
- Background worker and scheduler (`app/tasks/` is empty)
- Exports (`storage/exports/` exists but nothing writes to it)
- Scoring engine
- Data sources and ingestion
- Scheduled searches and notification delivery
- Provider integrations (CRM etc.) and a real email provider
- Operations and hardening

---

## Frontend — `hiring-intelligence-nextjs-tailwind-only`

**Stack:** Next.js 15, React 19, Tailwind CSS 3, lucide-react.

### Done (UI and prototype)

**Screens built**
- Auth: Login (demo credentials only), Onboarding
- Dashboard, Analytics
- Lead Discovery (table, filters, export modal), Lead Detail (score breakdown)
- Companies list, Company Detail
- Search Builder (`/search/new`), Saved Searches list and detail
- Alerts, Exports
- Settings: Profile, Workspace, Integrations, Data Sources

**Shared components:** AppShell, Header, Sidebar, Badge, Button, Card, MetricCard, Modal, PageHeader, LeadTable, ScoreBreakdown, ExportModal, ToastProvider.

**Exports:** CSV download built in the browser from the filtered leads (`src/lib/export.js`).

### How data works today (all mocked)
- All data comes from fixture files in `src/data/` (leads, companies, saved searches, alerts).
- Saved leads, saved searches, alerts, exports, profile and workspace settings are kept in `localStorage` (`src/lib/storage.js`).
- Login is hard-coded to `demo@hiringintel.ai` / `demo123`.
- The `src/app/api/*` route handlers return the fixtures or fake responses. For example, `POST /api/exports` always returns `completed`, and `DELETE /api/saved-searches/{id}` deletes nothing.
- No code calls `fetch()`. Some buttons show a success toast without doing anything: Save search, Run, Save lead, and Connect/Disconnect on integrations.

### Not done yet

**Connect to the backend (Phase 1 work still on the frontend side)**
- Shared API client (cookie session, CSRF header, error parsing, redirect to `/login` on 401)
- Real login, session, profile, workspace and onboarding
- Saved leads through the API

**Phase 2**
- Leads and companies read from the API, with server pagination, sorting, and filters kept in the URL
- Saved searches, alerts, dashboard and analytics on real data
- Loading, empty and error states (Skeleton, EmptyState, ErrorState components)
- Remove the fixtures and the data keys in `localStorage` from the pages

**Phase 3**
- Server exports, scoring display, data source and integration management

---

## Next steps

1. Backend Phase 2: saved searches, then alerts, then dashboard and analytics.
2. Frontend: add the API client and real auth, then replace fixtures screen by screen. Leads and companies can start now because those backend endpoints already exist.
3. Then Phase 3 on both sides.
