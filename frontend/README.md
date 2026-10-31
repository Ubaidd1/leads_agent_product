# Hiring Intelligence — Next.js + JSX + Tailwind CSS

A professional interactive prototype for a Remote Hiring Lead Intelligence Platform.

## Stack

- Next.js App Router
- JavaScript / JSX only — no TypeScript
- Tailwind CSS for all UI styling
- Lucide React icons
- Browser LocalStorage for demo persistence
- Next.js Route Handlers for demo API endpoints

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
  data/
  lib/
```

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Demo login

- Email: `demo@hiringintel.ai`
- Password: `demo123`

## Main routes

- `/dashboard`
- `/leads`
- `/leads/lead-1`
- `/companies`
- `/companies/novastack-labs`
- `/search/new`
- `/saved-searches`
- `/alerts`
- `/exports`
- `/analytics`
- `/settings`

## Notes

This package is a frontend-first interactive demo. Replace the mock files in `data/` and route handlers in `app/api/` with your production FastAPI/PostgreSQL services when integrating the real platform.
