# Hiring Intelligence — Next.js + JSX + Tailwind CSS

Customer-facing app for the Remote Hiring Lead Intelligence Platform. All data comes from the FastAPI backend (`../backend`); there are no fixtures or mock API routes.

## Stack

- Next.js App Router
- JavaScript / JSX only — no TypeScript
- Tailwind CSS for all UI styling
- Lucide React icons
- Same-origin proxy to FastAPI: `next.config.mjs` rewrites `/api/v1/*` to `BACKEND_URL`
- HttpOnly cookie session; CSRF token kept in memory only
- `localStorage` only for UI preferences (table vs card view)

## Styling rule

There is **no custom global CSS** in this project. The only stylesheet is `src/app/tailwind.css`, which contains only the required Tailwind directives:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

All component and page styling is done with Tailwind utility classes in JSX.

## Professional structure

```text
src/
  app/
    (auth)/
      login/page.js
      onboarding/page.js
    (platform)/
      layout.js
      dashboard/page.js
      leads/page.js
      leads/[id]/page.js
      companies/page.js
      companies/[id]/page.js
      search/new/page.js
      saved-searches/page.js
      saved-searches/[id]/page.js
      alerts/page.js
      exports/page.js
      analytics/page.js
      settings/
        page.js
        profile/page.js
        workspace/page.js
        integrations/page.js
        data-sources/page.js
    api/
      leads/
      companies/
      saved-searches/
      alerts/
      exports/
    layout.js
    page.js
    tailwind.css
  components/
    layout/
    leads/
    providers/
    ui/
  lib/
    api/
```

## Run

Start the backend first (see `../backend/README.md`), then:

```bash
cp .env.example .env.local   # BACKEND_URL=http://localhost:8000
npm install
npm run dev
```

Open `http://localhost:3000`. Create an account at `/onboarding`, or sign in with the demo user created by the backend's `python -m scripts.seed_demo` (it prints the password once).

## How data flows

| Layer | File |
|---|---|
| HTTP client (cookies, CSRF header, `ApiError`, 401 → `/login?next=…`, timeout/abort) | `src/lib/api/client.js` |
| One module per API area | `src/lib/api/*.js` |
| Session (user, workspace, permissions, workspace switching) | `src/components/providers/SessionProvider.jsx` |
| Route protection for every `(platform)` page | `src/components/layout/AuthGate.jsx` |
| Loading with cancellation, focus revalidation | `src/lib/useApi.js` |
| Filters ⇄ URL ⇄ API query ⇄ saved-search criteria | `src/lib/criteria.js` |
| Loading / empty / error states | `src/components/ui/States.jsx` |

Rules: a success toast appears only after the server confirms; filters, sort and page live in the URL; unknown values show as "Unknown"/"—", never as invented numbers.

## Routes

Auth: `/login`, `/onboarding` (account + preferences), `/forgot-password`, `/reset-password`, `/accept-invitation`.
App: `/dashboard`, `/leads`, `/leads/[id]`, `/companies`, `/companies/[id-or-slug]`, `/search/new`, `/saved-searches`, `/saved-searches/[id]`, `/alerts`, `/exports`, `/analytics`, `/settings/{profile,workspace,integrations,data-sources}`.

Integrations and Data Sources show "Coming soon" / "Not configured" until those backend features exist; they have no Connect toggles.
