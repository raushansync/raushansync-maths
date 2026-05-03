# RaushanSYNC Maths

RaushanSYNC Maths is a static-first mathematics learning platform for students. It serves class-wise maths landing pages, placeholder entrypoints for deeper notes and practice routes, progress tracking, dashboard tools, PWA/offline support, and an authenticated AI tutor using plain HTML, CSS, JavaScript, Supabase, and Cloudflare Workers.

Production site: https://maths.raushansync.com

## What This Codebase Contains

- Multi-page static frontend with no build step.
- Class landing pages for Class 6 through Class 12.
- Placeholder entrypoints for notes, video lesson, standard practice, advanced practice, and solution routes.
- Supabase authentication with email/password, Google OAuth, password reset, profile sync, and protected routes.
- Progress ticks and practice score persistence backed by Supabase tables with RLS.
- Student dashboard with profile editing, completion stats, recent activity, AI support mode, and account deletion.
- Cloudflare Worker API for authenticated AI tutor requests and account deletion.
- PWA manifest, service worker caching, offline fallback, app icons, screenshots, sitemap, robots file, and Android app links.

For the full technical map, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Tech Stack

- Frontend: vanilla HTML, CSS, and JavaScript
- Auth and database: Supabase Auth + Postgres + Row Level Security
- Edge API: Cloudflare Workers
- AI provider: Groq, called from the Worker
- PWA: Web App Manifest + Service Worker
- CI/smoke checks: Node.js scripts + GitHub Actions

## Key Files

- `index.html`: homepage and signed-in learning entry
- `dashboard/index.html`: protected student dashboard
- `assets/css/style.css`: global visual system
- `assets/js/auth-config.js`: Supabase client and auth helper contract
- `assets/js/script.js`: shared UI, components, theme, nav, PWA, progress bootstrap
- `assets/js/progress-tracker.js`: progress and score persistence API
- `assets/js/tick-manager.js`: completion tick UI
- `assets/js/quiz-score-handler.js`: quiz score display and save flow
- `ai-chat.js`: browser AI chat modal
- `worker.js`: Cloudflare Worker for AI and account deletion
- `service-worker.js`: PWA cache and offline routing
- `database/schema.sql`: Supabase tables, RLS, indexes, and triggers

## Local Development

Install dependencies:

```bash
npm install
```

Serve the static site from the repository root:

```bash
npx live-server .
```

or:

```bash
python -m http.server 8000
```

Use an HTTP server instead of opening files directly. Auth redirects, service-worker behavior, and AI origin checks are designed around localhost/127.0.0.1 or production origins.

## Worker Development

Run the Cloudflare Worker locally:

```bash
npx wrangler dev
```

Deploy the Worker:

```bash
npx wrangler deploy
```

Required Worker secrets:

```bash
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put SUPABASE_SECRET_KEY
```

Public Worker vars live in `wrangler.jsonc`:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

## Checks

Run smoke checks:

```bash
npm test
```

This checks JavaScript syntax for `ai-chat.js` and `service-worker.js`, then validates that every `CORE_ASSETS` entry in the service worker exists on disk.

## Database

The Supabase schema is in `database/schema.sql`.

It defines:

- `profiles`
- `progress`
- `practice_scores`
- RLS policies for per-user ownership
- updated-at triggers
- auth-user profile bootstrap trigger

Apply it carefully to a fresh or intentionally migrated Supabase project.

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md): full codebase architecture, route map, runtime contracts, data model, AI flow, service worker behavior, deployment notes, and known maintenance constraints.
- [LICENSE](./LICENSE): license text.
