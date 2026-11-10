# RaushanSYNC Science Architecture

## Overview

RaushanSYNC Maths is a static-first science learning platform. It uses plain HTML, CSS, and JavaScript for the user interface, Supabase for authentication and learning-data persistence, a Cloudflare Worker for authenticated account deletion, and a service worker for offline support.

## Main Components

| Area | Responsibility |
| --- | --- |
| Static pages | Class hubs, notes, video lessons, practice, legal, and account pages. |
| Shared JavaScript | Authentication, navigation, theme, progress, completion ticks, and practice scores. |
| Supabase | Authentication, profiles, progress, and practice scores protected by RLS. |
| Cloudflare Worker | Verifies authenticated account-deletion requests and performs server-side cleanup. |
| Service worker | Caches core static assets, provides an offline fallback, and avoids persistent caching of sensitive routes. |

## Browser Modules

- `assets/js/auth-config.js` configures Supabase and exposes authentication helpers.
- `assets/js/auth-guard.js` protects signed-in routes.
- `assets/js/script.js` injects shared components, manages navigation and theme state, and registers shared behavior.
- `assets/js/homepage-hero.js` selects the learning track from the profile and manages the profile-completion reminder.
- `assets/js/progress-tracker.js` persists progress and practice attempts.
- `assets/js/tick-manager.js` renders and updates completion ticks.
- `assets/js/quiz-score-handler.js` shows and saves final practice scores.

## Content and Practice Pages

Notes and video pages use progress ticks to record completion. Practice pages retain their local answer-checking behavior and use `quiz-score-handler.js` to save final scores. Protected practice routes use the authentication guard and no-store metadata.

## Account Deletion

The dashboard sends an authenticated `DELETE /api/account/delete` request. The Worker validates the request origin and Supabase bearer token, rate-limits the request, deletes account data, and revokes active sessions. The dashboard then clears local authentication state and sensitive caches.

`worker.js` is configured by `wrangler.jsonc` and requires these values:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

## PWA and Offline Support

`service-worker.js` pre-caches core assets and uses network-first navigation with an offline fallback. Sensitive routes, including auth, dashboard, and practice pages, use network-only document handling to avoid caching protected content.

## Validation

Run `npm test` to check Worker and service-worker syntax and verify that all `CORE_ASSETS` entries exist. The GitHub Actions smoke workflow runs the same command.

## Deployment

Deploy the static site through its hosting pipeline. Deploy the Cloudflare Worker after setting the Supabase secret with:

```bash
npx wrangler secret put SUPABASE_SECRET_KEY
npx wrangler deploy
```
