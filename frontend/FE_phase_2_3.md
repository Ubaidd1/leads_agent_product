# Frontend Plan — Phase 2 & Phase 3

## 1. Purpose and scope

This note covers the frontend work for **Phase 2 (core workflows)** and **Phase 3 (exports and source operations)** in [`BE_requirement.md`](BE_requirement.md) §8. It lists which screens change, what replaces the fixture data and `localStorage`, which UI states are needed, and the acceptance checks for each phase.

Today every screen reads from `src/data/*` fixtures or from `localStorage` (`src/lib/storage.js`). No screen calls `fetch()`. Several actions show a success toast even though nothing happened (for example "Save search" on Lead Discovery, "Run" on Saved Searches, "Save lead" on Lead Detail, and the integration Connect/Disconnect toggles).

### Assumed from Phase 1

Phase 2 depends on this Phase 1 work being done first:

- A shared API client (for example `src/lib/api.js`) that sends the session cookie, parses the standard error shape `{ error: { code, message } }`, and redirects to `/login` on `401`.
- Server-validated sessions in place of the demo login, plus profile, workspace, and onboarding settings loaded from the API.
- Saved leads persisted through `POST/DELETE /api/leads/{id}/save`.

If any of these slip, finish them at the start of Phase 2. Every item below relies on them.

### Conventions for both phases

- **Keep the page URLs.** All routes in `src/app/(platform)/` stay as they are.
- **Read all data through the API client.** Do not import from `src/data/*` in pages or components. The fixtures stay only as backend seed data.
- **Keep `localStorage` for UI preferences only**, such as table vs. card view or a collapsed sidebar. Remove the `savedLeads`, `savedSearches`, `alerts`, and `exports` keys from `src/lib/storage.js`.
- **Every data view needs four states:** loading (a skeleton that matches the layout), empty, error (with a retry), and success. Add shared `Skeleton`, `EmptyState`, and `ErrorState` components to `src/components/ui/`.
- **Show a toast only after the server confirms the action.** Disable the button while the request is in flight. Use optimistic updates only for actions that are cheap to undo (save/unsave, mark read), and roll back if the request fails.
- **Store filter, sort, and page state in the URL** (`useSearchParams` + `router.replace`) so views can be shared and refreshed. Debounce text search by about 300 ms.
- **Data-fetching approach:** decide this before Phase 2 starts. The options are a small custom `useApi` hook or a library such as SWR or TanStack Query. A library gives caching and revalidation, which the header alert badge and dashboard both need. Choose one and use it everywhere.

---

## 2. Phase 2 — Core workflows

**Goal:** lead/company discovery, saved searches, alerts, dashboard, and analytics all run on real, workspace-scoped server data. No toast reports an action that did not happen.

### 2.1 Lead Discovery — `src/app/(platform)/leads/LeadsPageClient.jsx`

| Now | Phase 2 |
|---|---|
| Filters the imported `leads` array with `useMemo` | Call `GET /api/leads` with `search`, `service`, `technology`, `intent`, `geography`, `freshness`, `minScore`, `sort`, `page`/`cursor`, `pageSize` |
| Hard-coded option lists for service and technology; intent offers only Strong/Medium | Load option lists from the API or a shared constants module agreed with the backend |
| Footer shows "Page 1 of 1 · 25/page" | Real pagination using the `total` the API returns; add a page-size selector |
| Results are always sorted by score | Add a sort control (score, freshness, hiring velocity), limited to fields the API allows |
| No geography or freshness filters | Add both filters to match Search Builder |
| Filter state lives only in `useState` | Sync all filters to the URL; `?search=` from the header keeps working |
| "Save search" shows a demo toast | Open a "Name this search" modal and call `POST /api/saved-searches` with the current filters |
| Save toggle writes the full lead object to `localStorage` | Use the Phase 1 save/unsave endpoints; the API returns saved state per row |
| Export uses the filtered client-side array | No change until Phase 3. Use the current filter set, not only the loaded page |

Also update `src/components/leads/LeadTable.jsx` to accept `loading`, a saved state per row, and a pending state per row.

### 2.2 Lead Detail — `src/app/(platform)/leads/[id]/page.js`

- Load from `GET /api/leads/{id}`. Remove the `|| leads[0]` fallback and show a real not-found page on `404`.
- The "Save lead" button shows the saved state from the server and toggles it. Remove the toast that fires without saving.
- Load hiring signals, timeline, sources, and confidence from the response. Remove the hard-coded "Repeated Hiring: Detected".

### 2.3 Companies — `src/app/(platform)/companies/page.js`, `companies/[id]/page.js`

- The list calls `GET /api/companies` with server-side search, sorting (intent score, velocity, open roles), pagination, and the four UI states.
- Detail calls `GET /api/companies/{id}` and takes the company's roles and leads from the response, not by filtering `leads`. Remove the `|| companies[0]` fallback and show a not-found page on `404`.

### 2.4 Header global search — `src/components/layout/Header.jsx`

- Replace the fixture-based `searchResults` with a debounced API call that returns a few companies and leads. Cancel stale requests with an `AbortController`.
- Make the `⌘K` hint work by focusing the input on ⌘K / Ctrl+K, or remove the hint.
- Replace the static "Updated 4 min ago" pill with the last-sync time from the API, or remove it.

### 2.5 Search Builder — `src/app/(platform)/search/new/page.js`

- "Estimated matches" currently shows a fixed 487. Replace it with a count query (a `GET /api/leads` call with `pageSize=1`, reading the total), debounced as criteria change.
- "Save search" opens a modal to set the name, frequency, and notification channels, then calls `POST /api/saved-searches` and goes to `/saved-searches/{id}`.
- "Search leads" sends **all** criteria to `/leads` in the URL, not only the technology.

### 2.6 Saved Searches — `src/app/(platform)/saved-searches/page.js`, `saved-searches/[id]/page.js`

| Action | Phase 2 behaviour |
|---|---|
| List | `GET /api/saved-searches`; show new/total match counts and `lastRun` from the server |
| Run | `POST /api/saved-searches/{id}/run`; show a running state on the card, then refresh the counts (poll if the API returns a run ID) |
| Duplicate | Create a copy through `POST /api/saved-searches` |
| Delete | Ask for confirmation in a modal, then `DELETE` |
| Pause / resume | New toggle → `PATCH { active }` |
| Detail page | `GET /api/saved-searches/{id}`, a paginated result table (replacing `leads.slice(0,5)`), run history, and an edit form (`PATCH`); `404` instead of falling back to the first search |

Pass a working save handler to `LeadTable` on the detail page. It currently receives `onSave={() => {}}`.

### 2.7 Alerts — `src/app/(platform)/alerts/page.js` and the header bell

- The list calls `GET /api/alerts`, paginated, with an unread/all filter.
- Mark one as read → `PATCH /api/alerts/{id}`. Mark all as read → `POST /api/alerts/mark-all-read`. Pause/resume → `PATCH`. Delete → `DELETE`. Update optimistically and roll back if the request fails.
- Clicking an alert opens the related lead, company, or saved search when the API provides a link.
- The header bell shows the real unread count (hide the dot when it is zero) and the latest three alerts. Refresh on window focus or on an interval. Real-time updates belong to Phase 3.

### 2.8 Dashboard — `src/app/(platform)/dashboard/page.js`

Replace every hard-coded value with data from `GET /api/dashboard`:

- The metric cards (1,284 / 186 / 342 / 82 and their percentage changes)
- The hiring-velocity bars (`velocity` and `heightClasses`). Tailwind cannot build class names from runtime values, so set bar height with an inline `style={{ height: \`${pct}%\` }}` or a fixed set of class steps.
- The intent distribution, the "+31% momentum" pill, and the "99.2% verification rate" label
- Top opportunities (`leads.slice(0,5)`) and recent signals (fixed strings with made-up timestamps)

Add a date-range selector (7 / 30 / 90 days) and show each metric's definition in a tooltip, using the wording agreed with the backend (BE §3 P1.5).

### 2.9 Analytics — `src/app/(platform)/analytics/page.js`

- Load the metric cards and the technology and industry breakdowns from `GET /api/analytics`, using the same date-range control as the dashboard.
- This page is currently a server component with constants. Either fetch on the server (forwarding the session cookie) or convert it to a client component. Use the same approach as the dashboard.
- `progressWidth` in `src/lib/ui.js` maps percentages to fixed classes. Check that it handles any value from 0 to 100.

### 2.10 Remove leftover demo code

- Remove all `@/data/*` imports from `src/app/(platform)/**` and `src/components/**`.
- Remove the `/api/*` Route Handlers that only return fixtures, or turn them into thin proxies to the backend (see BE §9.1).

### Phase 2 acceptance

- Filtering, sorting, and pagination on Leads and Companies return the correct server results, and the URL reproduces the same view after a refresh.
- Saved searches can be created, edited, paused, run, duplicated, and deleted, and the changes persist across browsers and devices.
- Alert read, pause, and delete state persists, and the header badge matches the Alerts page.
- Dashboard and Analytics numbers come from the API for the selected date range. No hard-coded metric remains.
- `grep -rn "@/data/" src/app/\(platform\) src/components` returns nothing.
- No success toast appears unless the server confirmed the action.

---

## 3. Phase 3 — Exports and source operations

**Goal:** exports are server-generated files with real status and history; source provenance, scoring, alerts, integrations, and data sources show real backend state.

### 3.1 Exports — `src/components/leads/ExportModal.jsx`, `src/app/(platform)/exports/page.js`

| Now | Phase 3 |
|---|---|
| `downloadLeads()` in `src/lib/export.js` builds the file in the browser | Call `POST /api/exports` with `{ format, filters }` or `{ format, leadIds }`, plus an idempotency key |
| The modal shows "Records: N" from the loaded array | Show the server's count for the selected filters, and warn when it exceeds the export limit |
| A toast appears right after the click | Show the job status (queued → running → completed / failed). Download automatically when it finishes, or offer "Go to Exports" for large jobs |
| History is a hard-coded `history` array | `GET /api/exports`, paginated, with status, format, record count, creator, created time, and expiry |
| "Download" re-exports all fixture leads | `GET /api/exports/{id}/download` (or a signed URL). Disable the button for expired or failed exports and show the error |

- While any export is queued or running, poll the job status, or use the push channel in 3.6 once it exists.
- Delete `src/lib/export.js` once nothing uses it.
- Lead Discovery, Lead Detail, and Dashboard should send **filters or lead IDs**, not lead objects.

### 3.2 Provenance and scoring — Lead Detail, `src/components/leads/ScoreBreakdown.jsx`

- Show each source with its provider, a link to the original URL, first-seen and last-seen dates, and verification status, replacing the joined `lead.sources` string.
- In the score breakdown, show the eight components with their maximums (25/20/15/10/10/10/5/5), the score version, and the calculation time, with a short explanation for each component from the API.
- Show "Deduplicated from N sources" with the merged source records that can be expanded.
- Add a "Score updated" marker when the score has changed since the user last viewed the lead (optional, if the API provides the history).

### 3.3 Data Sources — `src/app/(platform)/settings/data-sources/page.js`

- Replace the hard-coded `sources` array with data from the source registry API. Show the permission or licensing basis, last successful sync, the latest run's status and counts, and the error from the last failure.
- Use status badges for Active, Syncing, Failed, Paused, and Not configured, instead of always showing green.
- Add a sync-run history drawer, and for admins only, "Sync now" and "Pause" actions.
- Build the manual CSV import: upload, column mapping, validation preview, and results showing rows imported, skipped, or deduplicated. This screen depends on the backend import endpoint.
- Hide admin actions for users whose role does not allow them, using the role from the Phase 1 session.

### 3.4 Integrations — `src/app/(platform)/settings/integrations/page.js`

- Replace the `seed` array and its local toggle with `GET /api/integrations`.
- **Connect** runs the provider's OAuth or API-key flow (`POST /api/integrations/{provider}/connect`), then returns to this page and shows the result.
- **Disconnect** asks for confirmation, then calls `DELETE /api/integrations/{id}`.
- Each integration card shows its status (Connected, Error, Needs re-auth), the account it is connected to, its scopes, and the last delivery.
- Add a settings view per provider for field mapping (CRMs), the channel to post to (Slack), and the URL, secret, event types, and a test delivery (webhooks), plus a delivery log with retry status.
- Label providers the backend has not built yet as **"Coming soon"** and disable them. Do not show a working Connect button for them.

### 3.5 Alert delivery and saved-search scheduling

- On the Alerts page, show each alert's channel and delivery status (delivered, failed, or retrying), with the failure reason.
- In saved-search settings, offer real schedule options (frequency and time of day in the workspace timezone) and notification channels, limited to email, in-app, and the integrations that are connected.
- On the saved-search detail page, show the run history with status, match counts, and errors, and the time of the next scheduled run.

### 3.6 Real-time updates (optional)

- If the backend provides SSE or WebSockets, use them for new alerts (the header badge), export job status, and saved-search run completion. Otherwise keep polling, and slow it down while the tab is hidden.

### Phase 3 acceptance

- An export contains exactly the records allowed by the selected filters, appears in history with its real status, and can be downloaded until it expires and not after.
- Retrying an export or reconnecting an integration does not create duplicate jobs or connections (each request sends an idempotency key).
- Every lead shows sources with links and a score breakdown that matches the API's score version.
- The Data Sources and Integrations pages show only real backend state. Providers that are not built are clearly labelled as unavailable.
- No browser-side file generation remains, and `src/lib/export.js` is deleted.

---

## 4. Cross-cutting tasks (both phases)

- **Permissions in the UI:** hide or disable actions the user's role does not allow (workspace settings, integrations, data-source actions). The server still enforces the rules.
- **Accessibility:** the new modals, filters, and pagination must work with a keyboard, have focus traps and labels, and announce toasts through `aria-live`.
- **Error handling:** a shared error boundary for each route (`error.js`), `not-found.js` for detail pages, and user-facing messages built from the API error `code`.
- **Testing:** set up component tests (Vitest + Testing Library) and end-to-end tests (Playwright) for the main flows: filter → save search → run → alert → export → download. The project has no test setup yet.
- **Configuration:** set the API base URL through `NEXT_PUBLIC_API_BASE_URL`, or use same-origin proxy routes, depending on BE §9.1.
- **README:** remove the demo-login and `localStorage` notes once Phase 1 and Phase 2 have shipped.

## 5. Open questions for the backend team

1. Pagination style for leads and companies: page/offset or cursor? The UI differs (numbered pages vs. "Load more").
2. Should filter option lists (services, technologies, geographies) come from an API endpoint or a shared constants file?
3. Are exports always background jobs, or can small exports return the file directly?
4. Polling or a push channel (SSE/WebSocket) for alerts and job status?
5. What is the export record limit, and how long do export files remain available?
6. Which integrations are in scope for the first release, so the rest can be labelled "Coming soon"?
