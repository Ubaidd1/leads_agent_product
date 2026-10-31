# Backend Requirements — Hiring Intelligence

## 1. Purpose and scope

This document describes the backend needed to turn the current Hiring Intelligence frontend prototype into a persistent, multi-user application. It is based on the routes, screens, demo data, and API handlers currently in `src/`.

The README identifies FastAPI and PostgreSQL as the intended production integration. Those are reasonable choices, but no backend framework, database, authentication provider, migrations, external data providers, or production API client is currently configured. The requirements below describe capabilities and API behavior rather than requiring a specific implementation language.

## 2. Audit summary

### What exists

- Next.js App Router frontend with login/onboarding, dashboard, lead discovery and details, company views, saved searches, alerts, exports, analytics, and settings.
- Mock company, lead, saved-search, and alert records in `src/data/`.
- A small set of Next.js Route Handlers under `src/app/api/`.
- Browser `localStorage` for the demo session, saved leads, saved searches, alerts, profile, workspace preferences, onboarding choices, and integration preferences.
- Client-side lead filtering and CSV/Excel-compatible download generation.

### What is not implemented

- There is no database, ORM, schema, migration, or backend service configuration.
- The UI does not call its Route Handlers; displayed records come from imported demo data and local state. There are no `fetch()` calls in the application.
- Login checks a hard-coded demo email/password in the browser. There is no real account creation, session validation, password reset, or authorization.
- Most settings and user actions are browser-local only and are not shared between devices or workspace members.
- Data-source rows, analytics, several dashboard metrics, export history, and integration connection states are static presentation data.
- Saved-search scheduling, lead ingestion, notifications, CRM delivery, and webhook handling are not implemented.

Current demo data contains eight companies, eight leads, four saved searches, and four alerts. It is suitable as seed/demo data, not as a production source of truth.

## 3. Backend capabilities required

### P0 — Production foundation

1. **Authentication and account lifecycle**
   - Support registration/invitation, sign-in, sign-out, current-session lookup, and password reset.
   - Replace the browser-only demo credential check with a server-validated session.
   - Use secure, HTTP-only, same-site cookies or a vetted identity provider; do not store session tokens in `localStorage`.
   - Protect all dashboard and data APIs. Return `401` for unauthenticated requests and `403` when an authenticated user lacks permission.

2. **Workspace tenancy and authorization**
   - Persist users, workspaces, and workspace memberships.
   - Associate user-owned and workspace-owned records with their tenant; enforce tenant scoping on every query and mutation, including detail and download endpoints.
   - Provide a minimum role model (for example, owner/admin/member) and define who can manage members, workspace settings, integrations, and data sources.

3. **Persistent application data**
   - Store companies, hiring opportunities/leads, saved leads, saved searches, alerts, profile/workspace preferences, and export records.
   - Replace fixture imports and local-storage writes with API-backed reads and mutations.
   - Preserve the current public page URLs; backend API implementation must not require changing the Next.js page routes.

4. **Validated, consistent API**
   - Validate request bodies, query parameters, IDs, enums, and pagination limits.
   - Return stable JSON response shapes and meaningful HTTP status codes. Use a consistent error format, such as `{ "error": { "code": "...", "message": "..." } }`.
   - Do not report successful persistence, export completion, or integration connection unless the operation actually completed.

### P1 — Core hiring-intelligence product

1. **Lead and company search**
   - Search/filter by free-text query, service type, technology, hiring intent, geography/remote policy, freshness, minimum score, and company.
   - Sort by score, freshness, hiring velocity, and other explicitly supported fields.
   - Add server-side pagination (or cursor pagination), total result count, and bounded page sizes. The current “25/page” display is not real pagination.
   - Return detail records for leads and companies, including source provenance, verification state, timeline, and scoring explanation.

2. **Saved leads**
   - Persist each user's/workspace's saved-lead associations and support listing, saving, and unsaving.
   - Ensure save/unsave is idempotent and does not overwrite the canonical lead record.

3. **Saved searches**
   - Persist criteria, name, owner/workspace, active/paused state, frequency, and notification preferences.
   - Support create, list, detail, update, delete, duplicate, and run-now operations.
   - Return actual result counts and run timestamps; do not use fixed demo values such as `487` matches.

4. **Alerts and notifications**
   - Persist alert records and support listing, marking one/all as read, pausing/resuming, and deleting.
   - Generate alerts from saved-search matches or meaningful changes in hiring signals.
   - Record delivery channel, attempt/status, timestamps, and failure details. Email and in-app delivery are represented in the UI; delivery is not implemented.

5. **Dashboard and analytics**
   - Replace hard-coded totals, trends, intent distributions, technology/industry rankings, and recent-signal text with aggregations over the authorized tenant's data.
   - Specify metric definitions and reporting windows (for example, what qualifies as a “new” lead, “verified” signal, or hiring-velocity change) so dashboard and analytics numbers remain consistent.

6. **Exports**
   - Accept the selected filters/lead IDs and CSV or Excel-compatible format; authorize every requested record.
   - Generate a real file and return it directly or return a short-lived authorized download URL.
   - Persist export status, format, record count, requester, creation/expiry time, and file reference. The current export handler only returns a fabricated “completed” response; the browser currently builds files itself.
   - Set file-size/record limits and define how expired files are removed.

### P2 — Operational integrations and data supply

1. **Data ingestion and source management**
   - Implement adapters only for explicitly permitted or licensed sources shown in the UI (company careers pages, supported ATS/feed integrations, licensed partner feeds, and customer-provided CSV).
   - Track source configuration, permission/licensing basis, sync status, last successful sync, failures, and source-specific rate limits.
   - Normalize and deduplicate incoming job/company records; preserve the original source URL, source record ID, first/last-seen timestamps, and verification status.
   - Provide retry/backoff and operational visibility. Use a background worker/queue for scheduled or long-running ingestion rather than blocking web requests.
   - Do not depend on unauthorized scraping or a data source whose terms do not permit the intended use.

2. **Scoring and hiring signals**
   - Implement a versioned, testable scoring service for the current transparent 100-point breakdown: relevance (25), hiring intent (20), freshness (15), remote fit (10), commercial value (10), company activity (10), seniority (5), and data quality (5).
   - Persist score, component values, score version, calculation time, and rationale/provenance sufficient to explain a result.
   - Define how hiring velocity, repeated hiring, skill concentration, confidence, and freshness are calculated and refreshed. The current fixture data uses illustrative values and formulas, not an operating scoring engine.

3. **Integrations**
   - Treat HubSpot, Salesforce, Pipedrive, Slack, Zapier, and webhook entries as UI placeholders until implemented.
   - For each delivered integration, define connection/authentication flow, minimum permissions, field mapping, event types, retries, disconnect/revocation, and audit history.
   - Encrypt provider credentials at rest; verify inbound webhook signatures and make outbound deliveries retryable and idempotent.

## 4. Suggested data model

Use relational records and explicit foreign keys. The following entities cover current screens and the backend capabilities above:

| Entity | Important fields / relationships |
|---|---|
| `users` | Email (unique), password hash or identity-provider subject, name, status, created/updated timestamps |
| `workspaces` | Name, default currency, default geography, created/updated timestamps |
| `workspace_memberships` | Workspace, user, role, invitation/status, unique workspace/user pair |
| `user_preferences` | User, timezone, job title, notification preferences |
| `onboarding_preferences` | Workspace/user, selected services, technologies, geography, default freshness |
| `companies` | Stable ID/slug, name, domain, industry, location, size, technologies, departments, remote policy, overview |
| `jobs` / `leads` | Company, normalized title, service type, technologies, location/remote fit, salary/currency, role counts, first/last seen, source and verification status |
| `source_records` | Job/company relationship, source/provider, source record ID and URL, raw/normalized data reference, observed timestamps, license/permission metadata |
| `hiring_signals` | Company/job, signal type/value, observed time, source record, confidence, deduplication key |
| `lead_scores` | Lead/company, total score, component breakdown, score version, calculated time, rationale |
| `saved_leads` | Workspace/user and lead association, created time; unique association to prevent duplicates |
| `saved_searches` | Workspace/owner, name, structured criteria, schedule/frequency, active state, notification channels, last/next run |
| `saved_search_runs` | Search, run time/status, counts, error details; supports match history and reliable scheduling |
| `alerts` | Workspace/user/search, event type, title/detail, read/status, channel, created/delivered times |
| `export_jobs` | Workspace/requester, filters, format, status, count, storage key, expiry, error details |
| `integrations` | Workspace, provider, connection state, encrypted credential reference, scopes, timestamps |
| `data_sources` / `sync_runs` | Provider/configuration, permission status, sync status/times, counts, errors, retry metadata |

Store structured filter criteria as validated JSON or normalized relational fields. Keep tenant ownership explicit instead of relying on frontend-supplied workspace IDs. Index common search/filter fields, foreign keys, unique identifiers, and time-based reporting columns after confirming query patterns.

## 5. API contract to implement

The current Next.js API paths can be retained as the public application contract and implemented by Route Handlers or proxied to the planned FastAPI service. The table describes the minimum expected behavior; exact response fields should be agreed with the frontend before implementation.

| Method and path | Required behavior |
|---|---|
| `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session` | Account/session lifecycle; server-side validation and secure cookie session |
| `POST /api/auth/password-reset` and reset confirmation | Request and complete password reset without revealing whether an email exists |
| `GET /api/me`, `PATCH /api/me` | Current user/profile and profile updates |
| `GET /api/workspace`, `PATCH /api/workspace` | Current workspace settings and authorized updates |
| `GET /api/leads` | Filtered, sorted, paginated leads; accept `search`, `service`, `technology`, `intent`, `geography`, `freshness`, `minScore`, `sort`, `page`/`cursor`, and `pageSize` as supported parameters |
| `GET /api/leads/{id}` | Lead detail, associated company, signals, provenance, timeline, and score breakdown |
| `GET /api/leads/saved`, `POST /api/leads/{id}/save`, `DELETE /api/leads/{id}/save` | List/save/unsave tenant-authorized leads |
| `GET /api/companies`, `GET /api/companies/{id}` | Searchable/paginated company list and company detail with roles, hiring activity, and signals |
| `GET /api/saved-searches`, `POST /api/saved-searches`, `GET /api/saved-searches/{id}`, `PATCH /api/saved-searches/{id}`, `DELETE /api/saved-searches/{id}` | Full saved-search lifecycle; enforce workspace ownership |
| `POST /api/saved-searches/{id}/run` | Trigger/run search and return a run identifier/status or completed results |
| `GET /api/alerts`, `PATCH /api/alerts/{id}`, `POST /api/alerts/mark-all-read`, `DELETE /api/alerts/{id}` | List and mutate authorized alert state |
| `POST /api/exports`, `GET /api/exports`, `GET /api/exports/{id}/download` | Create export, retrieve history/status, and securely download generated file |
| `GET /api/dashboard`, `GET /api/analytics` | Tenant-scoped aggregate metrics and trends with explicit date ranges |
| `GET /api/integrations`, `POST /api/integrations/{provider}/connect`, `DELETE /api/integrations/{id}` | List, connect, and disconnect integrations when each provider is implemented |

The existing API handlers currently provide only demo behavior:

- `GET /api/leads` supports text search and `minScore`, but has no pagination and reads fixtures.
- `GET /api/leads/{id}` and `GET /api/companies/{id}` read fixtures.
- `GET /api/companies`, `GET /api/alerts`, and `GET /api/saved-searches` return fixture data.
- `POST /api/saved-searches` returns an ID but does not persist the record; `DELETE /api/saved-searches/{id}` reports deletion without changing data. There is no saved-search detail GET/PATCH or run endpoint.
- `POST /api/exports` returns a fabricated completed status and does not generate or store a file.

## 6. Frontend behavior that must be connected

| Current UI behavior | Backend requirement |
|---|---|
| Login uses a fixed demo credential in `src/app/(auth)/login/page.js` | Replace with authenticated API flow; implement reset link behavior and protect platform data |
| Onboarding writes criteria to local storage | Persist criteria against the user/workspace and load them on later sessions |
| Leads/companies and dashboard/analytics read imported fixtures | Load tenant-authorized records/aggregates from the API |
| Lead discovery has several client-side filters and a cosmetic page count | Move filtering and pagination to the API; preserve filter semantics and URL search |
| Saving a lead from discovery writes a full lead object to local storage; lead detail only shows a toast | Persist a lead association and return saved state consistently on both screens |
| Saved searches are partly local; “run” only displays a toast | Persist CRUD and implement search execution/scheduling |
| Alerts are local demo rows; read/pause/delete only mutate local state | Persist mutations and add event generation/delivery |
| Export downloads are generated in the browser; history is hard-coded | Generate exports through backend and load actual export history |
| Profile/workspace forms write only to local storage | Add validated read/update endpoints |
| Integration buttons only toggle local React state | Implement provider authorization and durable connection status or clearly label unavailable integrations |
| Data-source table is hard-coded | Load real source registry, permission, and sync health data |

## 7. Security, reliability, and operational requirements

- Enforce authentication and workspace authorization server-side on every protected endpoint; never trust client-provided tenant IDs or record ownership.
- Validate and normalize all input; cap page size, query length, export size, and request rates. Allowlist sort fields and formats.
- Hash passwords with a current password-hashing algorithm or delegate authentication to a vetted identity provider. Keep secrets and provider credentials out of source control and browser storage.
- Use HTTPS, secure session cookies, CSRF protections appropriate to the chosen session design, CORS allowlists, and rate limiting on login/reset/search/export endpoints.
- Use database transactions for related state changes; use idempotency keys for retried exports, integration events, and scheduled search runs.
- Use a background worker/queue for ingestion, scheduled saved searches, notifications, and large exports. Report queued/running/complete/failed states accurately.
- Encrypt sensitive credentials at rest. Restrict export file access with authorization or expiring signed links, and define retention/deletion policies.
- Record audit events for membership/role changes, integration changes, and export creation/download. Avoid logging passwords, tokens, or unnecessary personal data.
- Provide structured logs, request IDs, health/readiness checks, error monitoring, database backups, and restore procedures.
- Document retention, deletion, and source licensing/permission policies before loading production data.
- Add automated tests for authentication/authorization, tenant isolation, filtering/pagination, CRUD, scoring, export access, and error handling.

## 8. Delivery plan and acceptance criteria

### Phase 1: secure persistence

- Choose the backend deployment boundary and API base URL; retain the existing public page URLs.
- Implement database migrations, authentication/session management, workspace membership, profile/workspace settings, leads/companies reads, and saved-lead persistence.
- Replace demo login and local-only user/workspace/onboarding state.

**Acceptance:** users can sign in/out; unauthenticated requests cannot read platform data; a user cannot read or mutate another workspace's records; profile and workspace settings survive a new browser/device session.

### Phase 2: core workflows

- Implement searchable/paginated leads and companies, saved-search CRUD/run history, alert state, and tenant-scoped dashboard/analytics.
- Connect all corresponding pages to APIs and remove hard-coded success toasts for operations that have not completed.

**Acceptance:** filters and sorting return correct server results; saved searches/alerts persist across sessions; dashboard figures are derived from the same authorized data and documented metric definitions.

### Phase 3: exports and source operations

- Implement permitted-source ingestion, normalization/deduplication, scoring, scheduled matching, alert delivery, export jobs/files, and required integrations.

**Acceptance:** source provenance and score explanation are visible and reproducible; retries do not create duplicate records/notifications; exports contain only authorized filtered records and have real status/download behavior.

### Definition of backend readiness

- API schemas and errors are documented and consumed by the frontend.
- Database migrations and seed/demo-data strategy are reproducible.
- Authorization, tenant isolation, and core workflows have automated test coverage.
- Deployment has managed secrets, backups, logging/monitoring, and operational ownership.
- No production screen relies on fixture data or local storage for server-owned state.

## 9. Decisions to make before implementation

1. Confirm the backend service/deployment boundary (the README suggests FastAPI) and whether Next.js will proxy requests or call the service directly.
2. Choose identity provider versus first-party password authentication, and decide whether workspaces support invitations and multiple roles at launch.
3. Confirm production data providers, licensing/permission, supported regions, refresh cadence, and source retention.
4. Approve scoring formulas and definitions for freshness, verification, deduplication, intent, and hiring velocity.
5. Select email/in-app delivery providers, integration scope, and export storage/retention limits.
6. Define the first production release's minimum features; billing is not represented as an implemented product flow in the current frontend and is not included here.
