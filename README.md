# Hiring Intelligence — Remote Hiring Lead Intelligence Platform

Finds companies that are actively hiring, turns their job postings into scored, deduplicated leads, and gives sales and business-development teams search, alerts, analytics and exports on top of them.

| Folder | What it is | Details |
|---|---|---|
| [`backend/`](backend/) | FastAPI + PostgreSQL API, background worker | [backend/README.md](backend/README.md) |
| [`frontend/`](frontend/) | Next.js 15 customer app (JS/JSX, Tailwind) | [frontend/README.md](frontend/README.md) |
| `agent/` | Reserved for the agentic ingestion pipeline (empty for now) | — |

## Status

| Area | Phase 1 (foundation) | Phase 2 (core workflows) | Phase 3 (ingestion, scoring, integrations) |
|---|---|---|---|
| Backend | ✅ Done | ✅ Done | 🟡 Job queue, worker and CSV/XLSX exports done; the rest not started |
| Frontend | ✅ Connected to the API | ✅ Connected to the API | 🟡 Exports connected; integrations and data sources show "not available" |

The current snapshot is [backend/docs/PROJECT_STATUS.md](backend/docs/PROJECT_STATUS.md). The audit and open product decisions are in [backend/docs/INTEGRATION_AUDIT.md](backend/docs/INTEGRATION_AUDIT.md).

## How it fits together

```text
Browser ──► Next.js (localhost:3000)
              │  /api/v1/*  (same-origin rewrite, see frontend/next.config.mjs)
              ▼
            FastAPI (localhost:8000) ──► PostgreSQL ◄── Worker (python -m app.tasks.worker)
                                                         exports, cleanup, scheduled jobs
```

- **One origin for the browser.** The session is an HttpOnly cookie. The CSRF token is kept in memory and sent as `X-CSRF-Token` on every write.
- **Workspaces.** The workspace always comes from the session, never from the request. Records from another workspace return 404.
- **One filter definition.** Leads, saved searches, alerts, exports and analytics all use the same lead query, so their numbers agree.
- **No fake data.** Unknown values are null or "Unknown". Counts are only shown after something has actually run. A success message appears only after the server confirms the action.

## Features

- **Accounts:** sign-up, sign-in with "remember me", password reset, invitations, roles (owner, admin, member), and switching between workspaces.
- **Leads and companies:** search, filters, sorting and pages all run on the server and are kept in the URL. You can save leads, see where each lead came from, and see how its score was built.
- **Saved searches:**
  - **Runs:** each run reports how many leads match and how many are new since the last run, and keeps a history.
  - **Alerts:** each person has their own read and dismissed state.
  - **Delivery status:** each alert shows whether in-app and email delivery happened.
- **Dashboard and analytics:** grouped by each workspace's reporting timezone.
- **Exports:** the server builds CSV or Excel (.xlsx) files.
  - **Size:** up to 1,000 rows are built immediately; larger exports go to the background worker; the limit is 10,000 rows.
  - **Downloads:** files can be downloaded for 7 days, and every download is checked against your permissions.

## Quick start (local development)

Requirements: Python 3.11, Node.js 20+ (tested on 22), PostgreSQL 16.

**1. Database.** Create two UTF-8 databases, one for development and one for tests. The test database name must end in `_test`.

```sql
CREATE DATABASE leads_agent      OWNER hiring_user ENCODING 'UTF8' TEMPLATE template0;
CREATE DATABASE leads_agent_test OWNER hiring_user ENCODING 'UTF8' TEMPLATE template0;
```

**2. Backend**

```bash
cd backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                 # set DATABASE_URL and TEST_DATABASE_URL
alembic upgrade head
python -m scripts.seed_demo          # optional demo workspace; prints the demo password once
uvicorn app.main:app --reload --port 8000
```

In a second terminal, start the background worker. It is needed for exports over 1,000 rows and for the daily cleanup.

```bash
cd backend && source .venv/bin/activate
python -m app.tasks.worker
```

**3. Frontend**

```bash
cd frontend
cp .env.example .env.local           # BACKEND_URL=http://localhost:8000
npm install
npm run dev
```

Open http://localhost:3000. Create an account at `/onboarding`, or sign in as `demo@hiringintel.ai` with the password the seed printed.

**Health checks:**
- `GET http://localhost:8000/health`
- `GET http://localhost:8000/ready` checks the database and migrations, and also reports whether the worker is running.
- API docs: http://localhost:8000/docs

## Everyday commands

| Task | Command (from the folder shown) |
|---|---|
| Backend tests | `backend/`: `pytest` |
| Backend lint and format | `backend/`: `ruff check . && ruff format --check .` |
| New migration | `backend/`: `alembic revision --autogenerate -m "..."`, then review it and remove the duplicated `CheckConstraint` lines |
| Check models match migrations | `backend/`: `alembic check` |
| Frontend production build | `frontend/`: `npm run build` |

## Configuration

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL`, `TEST_DATABASE_URL` | `backend/.env` | PostgreSQL connections (`postgresql+psycopg://…`) |
| `TRUSTED_ORIGINS`, `FRONTEND_BASE_URL` | `backend/.env` | Allowed browser origins; base URL for reset and invitation links |
| `COOKIE_SECURE`, `COOKIE_SAMESITE` | `backend/.env` | `COOKIE_SECURE` must be `true` in production |
| `EMAIL_BACKEND` | `backend/.env` | Only `console` exists today, which logs messages instead of sending them |
| `BACKEND_URL` | `frontend/.env.local` | Where Next.js forwards `/api/v1/*` |

The full list is in [backend/README.md](backend/README.md#environment-variables). Never commit `.env` files.

## What's next

**Waiting on product decisions** (see the audit's decision table):
- Scoring formulas (D3.5) and whether the score is shared or per workspace (D3.4)
- Email provider (D3.7)
- AI model and embedding provider (AI-1 / AI-2)
- Which live job sources to enable, with permission evidence (SRC-1)

**Can start now:**
- Customer CSV import, with cleanup, duplicate detection and company matching
- Records showing a search's progress to the user
- Webhook integration
- Frontend tests (Vitest and Playwright)

## Repository notes

- `backend/` and `frontend/` each have their own git history (nested `.git` folders).
- Plans: [backend/docs/BACKEND_PHASES_2_3.md](backend/docs/BACKEND_PHASES_2_3.md) and [frontend/FE_phase_2_3.md](frontend/FE_phase_2_3.md).
