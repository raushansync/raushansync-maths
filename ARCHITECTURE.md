# RaushanSYNC Maths Architecture

Last reviewed: 2026-05-03

This document is the detailed technical reference for the RaushanSYNC Maths codebase. It describes the repository as it exists now, including the current uncommitted working-tree changes that affect homepage auth rendering, homepage quote rotation, selective auth-pending behavior, and service-worker cache versioning.

README.md is intentionally shorter and onboarding-focused. This file is the source of truth for implementation details, runtime contracts, data flow, deployment shape, and maintenance rules.

## 1. Executive Summary

RaushanSYNC Maths is a static-first, multi-page educational web application. The root site serves class landing pages and placeholder shells for deeper mathematics content through plain HTML documents, a shared CSS system, shared JavaScript modules, Supabase authentication and persistence, a Cloudflare Worker AI backend, and a service worker for PWA/offline behavior.

The architecture is deliberately simple at the hosting layer:

- Public pages, class landing pages, auth screens, dashboard, legal pages, assets, and shared fragments live directly in the repository.
- There is no frontend bundler, no SPA router, and no server-rendered HTML tier.
- Browser modules coordinate auth, component injection, progress ticks, quiz scoring, AI chat UI, theme state, PWA registration, and dashboard behavior.
- Supabase handles user identity and row-level-security protected persistence.
- Cloudflare Workers protect secrets and enforce server-side policy for AI and account deletion.
- The service worker keeps core assets and selected content available offline while avoiding persistent caching of sensitive auth/protected documents.

The result is a small, cache-friendly educational product that can be hosted like a static site while still supporting signed-in student workflows.

## 2. Product Scope

Primary product capabilities:

- Maths learning pages for Classes 6 through 12.
- Chapter hub pages with notes, video lessons, standard practice, and advanced practice slots.
- Detailed notes pages with structured concept explanations.
- Quiz/practice pages with instant feedback, AI discussion support, score persistence, and completion tracking.
- Student dashboard with profile, completion counters, recent activity palettes, profile editor, AI support mode, and account deletion.
- Supabase email/password and Google OAuth authentication.
- Password reset and reset-confirmation flows.
- PWA install metadata, offline fallback, and runtime caching.
- SEO metadata, sitemap, robots file, Open Graph image, app icons, Android app link metadata, and public legal pages.

Non-goals visible in the current codebase:

- No React/Vue/Svelte/Angular runtime.
- No frontend build or compile step.
- No dynamic server-side page generation.
- No custom backend server outside the Cloudflare Worker.
- No historical attempt analytics table; practice_scores stores the latest score per user/site/practice path.

## 3. Production Topology

Production domain:

- `https://maths.raushansync.com`
- `CNAME` contains `maths.raushansync.com`.

Static site layer:

- Files are served from the repository-style static directory layout.
- `.nojekyll` exists so static hosts such as GitHub Pages do not apply Jekyll processing.
- `robots.txt` points crawlers to `https://maths.raushansync.com/sitemap.xml`.

Cloudflare Worker layer:

- Worker name: `quiz-ai-tutor`
- Worker entry point: `worker.js`
- Wrangler config: `wrangler.jsonc`
- Compatibility date: `2026-04-15`
- Observability is enabled with invocation logs and head sampling set to 1.

Supabase layer:

- Public Supabase project URL and publishable key are embedded in `auth-config.js` and `wrangler.jsonc`.
- The publishable key is public by design; RLS is the real data boundary.
- Secret/admin operations require Cloudflare Worker secrets.

External LLM provider:

- Groq chat completions endpoint is called only from the Worker.
- Browser code never receives the Groq API key.

## 4. Runtime Actors and Boundaries

Browser client:

- Loads static HTML and shared CSS.
- Loads shared JS modules directly through script tags.
- Registers the service worker.
- Stores theme preference and Supabase session state in browser storage.
- Uses Supabase client APIs for auth and RLS-scoped reads/writes.
- Sends authenticated AI/account deletion requests to the Worker.

Service worker:

- Pre-caches core assets.
- Caches selected static/content runtime responses.
- Avoids caching sensitive document routes.
- Serves `/offline/` as document fallback where appropriate.

Supabase:

- Owns auth users, sessions, and OAuth handling.
- Stores `profiles`, `progress`, and `practice_scores`.
- Enforces RLS ownership isolation.

Cloudflare Worker:

- Verifies allowed origins.
- Verifies Supabase bearer tokens.
- Rate limits AI and account deletion requests per user/IP bucket.
- Calls Groq using server-side secret credentials.
- Performs account deletion with Supabase service-role/admin secret.

Groq:

- Receives sanitized chat completion payloads from the Worker.
- Returns assistant content to Worker, which returns sanitized JSON to browser.

## 5. Repository Map

Top-level files:

| Path | Responsibility |
| --- | --- |
| `index.html` | Homepage, guest/sign-in aware learning entry, profile-completion modal, student-support AI modal shell. |
| `404.html` | Static not-found page. |
| `login.html` | Root compatibility login route; currently byte-identical to `login/index.html`. |
| `signup.html` | Root compatibility signup route; similar to but not byte-identical with `signup/index.html`. |
| `ai-chat.js` | Shared browser AI chat modal runtime. |
| `service-worker.js` | PWA cache, offline, and sensitive-route fetch policy. |
| `worker.js` | Cloudflare Worker for AI tutor and account deletion APIs. |
| `manifest.json` | PWA install metadata, icons, screenshots, related Android app. |
| `robots.txt` | Search crawler policy and sitemap location. |
| `sitemap.xml` | Production sitemap for public/static content. |
| `CNAME` | Custom domain declaration. |
| `wrangler.jsonc` | Worker deployment configuration. |
| `package.json` | Node smoke/test scripts and Wrangler dev dependency. |
| `package-lock.json` | Locked Node dependency graph. |
| `LICENSE` | Project license text. |
| `ARCHITECTURE.md` | This detailed reference. |
| `README.md` | Short project overview and onboarding guide. |

Application directories:

| Directory | Responsibility |
| --- | --- |
| `about/` | Public about page. |
| `account-deletion/` | Public account deletion explainer/instructions page. |
| `class06/` to `class12/` | Class landing pages and chapter cards. |
| `components/` | HTML fragments fetched into pages at runtime. |
| `dashboard/` | Protected dashboard application page. |
| `database/` | Supabase SQL schema, RLS policies, triggers, and grants. |
| `future-content/` | Advanced-track placeholder route for undergraduate/postgraduate/PhD profile paths. |
| `icons/` | PWA icons. |
| `login/`, `signup/` | Canonical auth route directories. |
| `notes/` | Learning notes and embedded concept-practice pages. |
| `offline/` | Offline fallback document. |
| `password-reset/` | Password reset request route. |
| `practice/` | Standard protected practice pages. |
| `practice-advanced/` | Advanced protected practice pages. |
| `practice-solution/` | Solution/video solution style content. |
| `privacy/`, `terms/` | Public legal pages. |
| `reset-confirmation/` | Password update route after reset link session. |
| `scripts/` | Node validation utility for service-worker core assets. |
| `video-lessons/` | Video lesson route tree. |

Asset subdirectories:

| Directory | Responsibility |
| --- | --- |
| `assets/css/` | Global stylesheet. |
| `assets/js/` | Shared browser modules. |
| `assets/og/` | Open Graph image. |
| `assets/screenshots/` | PWA manifest screenshots. |
| `.github/workflows/` | CI smoke-check workflow. |
| `.well-known/` | Android app links metadata. |

## 6. Current Content Inventory

The repository currently contains these major HTML route groups:

- 4 root-level HTML files: `index.html`, `404.html`, `login.html`, `signup.html`.
- 7 class landing pages: `class06/` through `class12/`.
- 19 files under `notes/`.
- 1 standard Class 6 practice page under `practice/`.
- 1 advanced Class 6 practice page under `practice-advanced/`.
- 1 practice solution page under `practice-solution/`.
- 1 video lessons page under `video-lessons/`.
- 1 dashboard page.
- 1 each for about, account deletion, future content, offline, password reset, reset confirmation, privacy, terms, login directory, and signup directory.
- 3 component fragments.

Current visible course/content coverage:

- Class 6 landing page has Chapter 1 active with video lessons, notes, practice, and advanced practice. Later chapter cards are present but disabled/coming soon.
- Class 7 landing page has Chapter 1 notes active. The chapter is decomposed into a chapter overview, 8 core concept pages, 8 concept-specific practice pages, and a congratulations page. Later chapter cards are present but disabled/coming soon.
- Class 8 through Class 12 landing pages exist as route scaffolds/content cards, with varying amounts of inline content and future/disabled links.
- The service worker's `CORE_ASSETS` currently pre-caches homepage, offline page, manifest, key shared assets/components, class landing pages, Class 6 video, and Class 7 Chapter 1 notes/core concept routes.

## 7. Page Families

### 7.1 Public Marketing/Information Pages

Representative pages:

- `index.html`
- `about/index.html`
- `privacy/index.html`
- `terms/index.html`
- `account-deletion/index.html`
- `404.html`
- `offline/index.html`

Common traits:

- Use shared header shell with `<div id="nav"></div>`.
- Use `<div id="footer"></div>` where footer injection is desired.
- Load `/assets/css/style.css`.
- Most public pages load Supabase/auth scripts so the shared nav can show user state and sign-out affordances.
- Public pages generally should render immediately and should not be hidden behind auth checks.
- The service worker treats public documents as network-first with cache fallback.

### 7.2 Class Landing Pages

Representative pages:

- `class06/index.html`
- `class07/index.html`
- `class08/index.html`
- `class09/index.html`
- `class10/index.html`
- `class11/index.html`
- `class12/index.html`

Common traits:

- Public course hubs.
- Include SEO metadata, canonical URLs, icons, manifest, Google Fonts, global CSS, and structured data on many pages.
- Render chapter cards with descriptions and action rows.
- Active content links use normal anchors.
- Future content uses disabled buttons/anchors with `aria-disabled="true"` and `tabindex="-1"`.
- Load Supabase, `auth-config.js`, `auth-guard.js`, and `script.js`.

Class landing pages are not currently protected routes. They can be visited by guests.

### 7.3 Notes Pages

Representative pages:

- `notes/class06/chapter01-the-wonderful-world-of-science/index.html`
- `notes/class07/chapter01-nutrition-in-plants/index.html`
- `notes/class07/chapter01-nutrition-in-plants/core-concept-1/index.html`

Common traits:

- Use `main.notes-page` and `.notes-container`.
- Use `.notes-header`, breadcrumbs, `.notes-box`, `.palette`, tables, concept summaries, warnings, and navigation buttons.
- Many include JSON-LD article/breadcrumb metadata.
- Include a progress tick container such as:

```html
<div id="note-tick" data-tick-container data-tick-position="header" data-tick-type="article"></div>
```

- Load `progress-tracker.js` and `tick-manager.js` when completion tracking is enabled.
- Are generally cacheable as content/static pages.
- Are not classified as protected by `auth-config.js` unless their path includes `/practice`.

### 7.4 Practice Pages

Representative pages:

- `practice/class06/chapter01-the-wonderful-world-of-science/index.html`
- `practice-advanced/class06/chapter01-the-wonderful-world-of-science/index.html`
- `notes/class07/chapter01-nutrition-in-plants/core-concept-1/practice1/index.html`

Common traits:

- Protected by frontend auth rules because paths include `/practice` or `/practice-advanced`, except for `/practice-solution`.
- Many set `auth-pending` immediately in the document head to reduce protected-content flash.
- Include quiz cards with `.quiz-card`, `data-type`, `data-answer`, and optional `data-reason` attributes.
- Use regular quiz buttons for local answer checking.
- Use `.discuss-ai-btn` buttons to open the AI tutor modal after a question has context.
- Include a progress tick with `data-tick-type="practice"`.
- Include `quiz-score-handler.js` for final score card, latest score display, practice score persistence, and completion marking.
- Load `ai-chat.js` where AI discussion is available.

Important current ordering constraint:

- Several practice pages load `/assets/js/quiz-score-handler.js` in the `<head>` before `auth-config.js`.
- `quiz-score-handler.js` currently calls `window.logEvent('Quiz score handler loaded')` at file load.
- `window.logEvent` is defined by `auth-config.js`, so this is a script-order hazard unless a page defines `window.logEvent` earlier or the handler is loaded after auth-config.
- This document records the current state; a future cleanup should either guard that call or move the handler after auth-config.

### 7.5 Dashboard

Primary page:

- `dashboard/index.html`

Traits:

- Protected route.
- Uses large inline page-specific CSS and JS in addition to shared assets.
- Loads Supabase, `auth-config.js`, `progress-tracker.js`, `tick-manager.js`, `script.js`, `auth-guard.js`, and `ai-chat.js`.
- Has dashboard widgets for account status, completed article count, completed practice count, profile details, getting started actions, and critical settings.
- Provides profile editing, recent-progress palettes, student-support AI mode, and account deletion UI.
- Includes a 15-second account deletion security delay after typed/checkbox confirmation.

### 7.6 Auth Pages

Primary pages:

- `login/index.html`
- `signup/index.html`
- `password-reset/index.html`
- `reset-confirmation/index.html`
- root compatibility files `login.html` and `signup.html`

Traits:

- Marked `noindex, nofollow, noarchive`.
- Include no-store cache meta tags where appropriate.
- Use Supabase email/password auth.
- Login and signup also support Google OAuth.
- Redirect targets are sanitized through auth helpers before navigation.
- Password reset sends Supabase reset emails to `/reset-confirmation`.
- Reset confirmation expects a valid Supabase session from the emailed link before allowing password update.

## 8. Shared Browser Modules

### 8.1 `assets/js/auth-config.js`

Primary responsibility:

- Central Supabase client initialization and auth helper contract.

Key exports on `window`:

- `window.supabaseClient`
- `window.authState`
- `window.whenAuthReady()`
- `window.getCurrentSite()`
- `window.getCurrentPath()`
- `window.normalizePath(path)`
- `window.isUserLoggedIn()`
- `window.getCurrentSession()`
- `window.logEvent(eventName, eventData)`
- `window.markAuthReady()`
- `window.getSafeRedirectPath(rawValue, fallback, options)`
- `window.getPostAuthRedirectPath(fallback)`
- `window.buildLoginRedirectUrl(targetPath)`
- `window.redirectToPath(path, options)`
- `window.redirectToLogin(targetPath)`
- `window.getCurrentUser()`
- `window.syncUserProfile(options)`
- `window.getUserProfile(options)`
- `window.clearSensitiveCaches()`
- `window.signOut()`
- `window.requireAuth()`
- `window.redirectAuthenticatedUser(fallback)`
- `window.isAuthenticated()`
- `window.isProtectedPath(pathname)`

Recent/current behavior:

- `auth-pending` is now applied only on sensitive paths:
  - `/login`
  - `/signup`
  - `/dashboard`
  - paths containing `/practice` except `/practice-solution`
- This lets public pages render immediately while still hiding sensitive pages until auth status is known.

Supabase config:

- Defaults are hard-coded:
  - `DEFAULT_SUPABASE_URL`
  - `DEFAULT_SUPABASE_PUBLISHABLE_KEY`
- Runtime override is possible through `window.__SUPABASE_CONFIG__`.

Profile sync model:

- Reads full name, education level, and phone from `user_metadata`.
- Syncs those fields into `public.profiles`.
- Email remains in Supabase Auth (`auth.users`) and is not duplicated into `profiles`.
- Uses fallback profiles so UI can still render if profile sync fails.

Route model:

- Auth pages: `/login`, `/signup`, `/dashboard`.
- Protected prefixes: `/dashboard`, `/practice/`, `/practice-advanced/`.
- Additional rule: any normalized path containing `/practice` is protected unless it contains `/practice-solution`.

Security model:

- Same-origin redirect normalization prevents open redirects.
- Sensitive caches are cleared on sign out.
- Session state changes emit `rs:auth-state-change`.

### 8.2 `assets/js/auth-guard.js`

Primary responsibility:

- Enforce route-level auth and hide/show content at the right time.

Behavior:

- Requires `auth-config.js` to be loaded first.
- Waits for `window.whenAuthReady()`.
- Redirects unauthenticated users away from protected pages to `/login?redirect=...`.
- Redirects authenticated users away from `/login` and `/signup` to `/dashboard`.
- Calls `window.markAuthReady()` for allowed render states.
- Adds `auth-error` if auth check has not completed after 10 seconds.

### 8.3 `assets/js/script.js`

Primary responsibility:

- Global UI behavior and shared component composition.

Responsibilities:

- Theme toggle:
  - Reads/writes `localStorage.theme`.
  - Honors `prefers-color-scheme`.
  - Syncs the browser theme-color meta tag to the current primary color.
- Navigation:
  - Sets up older `.nav-links` menu behavior where present.
  - Sets up current hamburger/menu system from `components/nav.html`.
  - Highlights active links.
  - Auto-hides the fixed header on downward scroll.
  - Re-initializes on `pageshow`.
- Component injection:
  - Fetches `/components/nav.html`, `/components/footer.html`, and `/components/support-cta.html`.
  - Falls back to relative component paths based on page depth.
  - Uses `{ cache: 'no-cache' }` for fetches.
- PWA:
  - Registers `/service-worker.js` on load.
- Progress bootstrap:
  - Waits for auth readiness.
  - Calls `TickManager.initializePageTicks()` when available.
  - Calls `ProgressTracker.loadPageProgress()` for signed-in users.
- Dashboard bridge:
  - Exposes `window.updateProgressDisplay()`.
- Navbar user display:
  - Shows user name and sign-out buttons when signed in.

### 8.4 `assets/js/homepage-hero.js`

Primary responsibility:

- Make the homepage entry area aware of signed-in user state and profile track.

Track routing:

- `class 06` through `class 12` map to `/class06/` through `/class12/`.
- `undergraduate`, `postgraduate`, and `phd` map to `/future-content/?track=...`.
- Missing/unknown education level creates a locked state that opens the profile-help modal.

Current/recent behavior:

- Maintains separate quote sets for school, advanced, and locked states.
- Rotates quote/title text every 10 seconds.
- Applies a typewriter effect unless `prefers-reduced-motion: reduce` is active.
- Uses crypto-backed random selection when available and avoids immediately repeating the previous quote.
- Adds/removes `home-hero-reserved` to prevent homepage layout jumping when a signed-in state is likely or confirmed.
- Starts learning, dashboard access, and AI support are blocked by profile-completion modal if the user has no recognized education level.

Homepage early reservation:

- `index.html` has an early inline script that detects Supabase auth storage keys and pre-adds `home-hero-reserved`.
- This reserves vertical space before auth/profile data finishes loading.

### 8.5 `assets/js/progress-tracker.js`

Primary responsibility:

- Supabase persistence API for progress and practice score data.

Important APIs:

- `startQuestion(questionId)`
- `getElapsedTime(questionId)`
- `saveAttempt(attemptData)`
- `getAttemptHistory(filters)`
- `getPracticeStats(practicePath)`
- `getQuizStats(quizUrl)` as backward-compatible alias
- `getOverallStats()`
- `detectItemType(path)`
- `getProgress(site, itemPath)`
- `setProgress(site, itemPath, itemType, completed)`
- `toggleProgress(site, itemPath, itemType)`
- `markCompleted(site, itemPath, itemType)`
- `loadPageProgress()`
- `savePracticeScore(site, practicePath, score)`
- `getPracticeScore(site, practicePath)`
- `deleteAllAttempts()`

Persistence model:

- Uses `progress` for completion state.
- Uses `practice_scores` for latest score per practice route.
- Derives `site` using `window.getCurrentSite()`.
- Normalizes paths through `window.normalizePath()` when available.

Notable behavior:

- `saveAttempt()` converts per-question boolean correctness into a 0 or 100 score under the current simplified `practice_scores` schema.
- `savePracticeScore()` stores a final computed percentage.
- `getPracticeScore()` currently returns `null` when the stored score is `0`, because it checks truthiness before returning. This is a known implementation detail to consider if showing previous failed attempts matters.

### 8.6 `assets/js/tick-manager.js`

Primary responsibility:

- Render and synchronize completion tick UI.

Tick states:

- `completed`
- `incomplete`
- `loading`
- `error`

Tick flow:

1. `initializePageTicks()` finds `[data-tick-container]` elements.
2. Each container is initialized once through `data-tickInitialized`.
3. The manager derives site, path, item type, position, and custom class from data attributes or defaults.
4. It renders a button with a generated tick ID.
5. If logged in, it reads persisted progress and updates initial state.
6. On click, unauthenticated users are redirected to login.
7. Authenticated clicks toggle the row in Supabase through `ProgressTracker.toggleProgress()`.
8. UI updates after the persisted state is re-read.
9. `window.updateProgressDisplay()` is called if available.

Lifecycle:

- Also initializes on `window.load` if the user is already logged in.
- Clears cached tick elements on `rs:auth-state-change` logout and `user-logout`.

### 8.7 `assets/js/quiz-score-handler.js`

Primary responsibility:

- Compute, display, and persist final quiz/practice score.

Behavior:

- Discovers `.quiz-card` elements.
- Reads correct answers from `data-answer`.
- Supports single and multiple selected answers by comparing sorted arrays.
- Tracks answered cards and correct card indexes.
- Creates a submit button if absent.
- Shows previous score when available.
- On submit:
  - Requires login.
  - Requires at least one answered card.
  - Renders `.quiz-score-card`.
  - Saves final score to `practice_scores`.
  - Marks current page complete in `progress` as `item_type='practice'`.

Known implementation constraints:

- Only interactions with `.quiz-btn:not(.discuss-ai-btn)` update the score handler's answered/correct sets.
- Subjective cards without `data-answer` are included in `totalQuestions` by the current selector, which can lower percentage scores if they are not answerable by the scoring logic.
- As noted above, file-load `window.logEvent()` requires auth-config ordering or a guard.

### 8.8 `assets/js/auth-logout-handler.js`

Primary responsibility:

- Utility for pages that want a declarative `data-action="logout"` click target.

Behavior:

- Exposes `window.handleLogout(options)`.
- Confirms sign out unless `quiet` is true.
- Calls `window.signOut()`.
- Dispatches `user-logout` before logout to support progress UI cleanup.

Current usage note:

- The shared navbar primarily wires sign-out through `script.js`; this file is available as a compatibility/helper module.

## 9. Shared Component System

Components:

- `components/nav.html`
- `components/footer.html`
- `components/support-cta.html`

Runtime loading:

- `script.js` calls `loadComponent('nav', 'nav')`, `loadComponent('footer', 'footer')`, and `loadComponent('support-cta', 'support-cta')`.
- If a mount element does not exist, loading for that component is skipped.
- The loader tries an absolute `/components/...` URL first.
- It then tries relative fallbacks based on current URL depth.

Navigation component:

- Renders the user info display, desktop sign-out button, hamburger button, class links, legal links, and mobile sign-out button.
- Depends on `script.js` for interactions and auth-state display.
- Uses inline SVG icons.

Footer component:

- Renders community/contact/social links.
- Links to privacy, account deletion, and terms.
- Contains copyright and usage text.

Support CTA:

- Currently only contains an empty `.subscribe-card` wrapper.
- It is still part of the component loading contract and service-worker core assets.

## 10. CSS and Visual System

Primary file:

- `assets/css/style.css`

Design tokens:

- CSS custom properties under `:root`.
- `.dark-mode` overrides for color palette, background, text, cards, border, and header.
- Important variables:
  - `--primary-color`
  - `--primary-color-dark`
  - `--background-color`
  - `--text-color`
  - `--secondary-text-color`
  - `--card-background`
  - `--card-shadow`
  - `--border-color`
  - `--header-bg`
  - `--header-height`
  - `--container-padding`

Major styling areas:

- Base reset, typography, container.
- Fixed translucent header and auto-hide variant.
- Theme toggle button.
- Current hamburger/navbar menu.
- Homepage welcome section and signed-in learning card.
- General content sections, card grids, buttons, palettes.
- Footer and legal/support links.
- Notes page layout, boxes, tables, diagrams, breadcrumbs, print styles.
- Quiz cards, options, feedback, answer blocks, submit score card.
- AI chat modal, message markdown styles, typing animation, mobile layout.
- Progress tick states and responsive tick placement.

Current/recent homepage styling changes:

- Guest and user homepage action containers start hidden until JS chooses the correct state.
- `home-hero-reserved` reserves larger vertical space for signed-in users to avoid layout jump.
- Home learning quote typing cursor is styled through `home-learning-title--typing`.
- Mobile layout centers the signed-in card and constrains action buttons.

Maintenance note:

- The global stylesheet is large and combines multiple page families. When adding new styles, prefer scoping with route/body classes such as `.home-page`, `.notes-page`, `.practice-page`, or specific component classes.

## 11. Authentication Architecture

Provider:

- Supabase Auth using `@supabase/supabase-js@2.38.4` from jsDelivr.

Supported auth flows:

- Email/password signup.
- Email/password login.
- Google OAuth login/signup.
- Password reset email.
- Reset confirmation and password update after link session.
- Local/session sign out.
- Account deletion through Worker and Supabase admin APIs.

Session lifecycle:

- Supabase client is created with:
  - `persistSession: true`
  - `autoRefreshToken: true`
  - `detectSessionInUrl: true`
- `initializeAuth()` calls `auth.getSession()`.
- Auth state is mirrored into `window.authState`.
- `window.whenAuthReady()` resolves once.
- `onAuthStateChange` updates global state and dispatches `rs:auth-state-change`.

Route protection:

- Protection is implemented client-side for page UX and should not be treated as the only security boundary.
- Actual private data is protected through Supabase RLS and Worker bearer-token checks.

Redirect safety:

- Redirect values are parsed against `window.location.origin`.
- Cross-origin redirects are rejected.
- Auth pages are rejected as redirect targets unless `allowAuthPages` is explicitly true.
- The fallback path defaults to `/dashboard`.

Sign out:

- Calls `supabaseClient.auth.signOut()`.
- Clears sensitive same-origin Cache Storage entries.
- Redirects to login with `message=signed-out`.

## 12. Profile and Homepage Track Model

Profile fields:

- `id`
- `full_name`
- `education_level`
- `phone`
- `created_at`

Email:

- Email remains in Supabase Auth.
- Dashboard reads email from `currentUser.email`.

Education levels:

- `class 06` through `class 12` route to class pages.
- `undergraduate`, `postgraduate`, `phd` route to the advanced/future content page.
- Missing/unknown education level locks homepage learning actions and prompts the user to edit profile.

Profile completeness:

- Dashboard treats profile as complete when full name, email, education level, and phone exist.
- Homepage learning actions only require a recognized education level/track.

Profile update flow:

1. User opens dashboard edit modal.
2. Client validates full name, email, education level, and phone length.
3. Email changes call `supabase.auth.updateUser({ email })`.
4. Metadata changes call `supabase.auth.updateUser({ data: ... })`.
5. `window.syncUserProfile({ explicitProfile })` updates/inserts `profiles`.
6. UI updates local `currentUser`, `currentProfile`, visible fields, and status.

## 13. Data Model

Schema source:

- `database/schema.sql`

### 13.1 `public.profiles`

Purpose:

- Store profile metadata that is not email.

Columns:

- `id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
- `full_name TEXT NOT NULL`
- `education_level TEXT`
- `phone TEXT`
- `created_at TIMESTAMPTZ DEFAULT NOW()`

Constraints:

- `full_name <> ''`

RLS:

- Users can select, insert, update, and delete only their own profile where `auth.uid() = id`.

Bootstrap:

- `public.handle_new_user()` creates/updates a profile after auth user insert.

### 13.2 `public.progress`

Purpose:

- Track completion state for notes/articles and practice pages.

Columns:

- `id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY`
- `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `site TEXT NOT NULL`
- `item_path TEXT NOT NULL`
- `item_type TEXT NOT NULL`
- `completed BOOLEAN DEFAULT FALSE`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`

Constraints:

- `UNIQUE (user_id, site, item_path)`
- `item_type IN ('article', 'practice')`

Indexes:

- `idx_progress_user_id`
- `idx_progress_user_id_item_type`
- `idx_progress_user_id_site`

RLS:

- Users can select, insert, update, and delete only rows where `auth.uid() = user_id`.

### 13.3 `public.practice_scores`

Purpose:

- Store latest practice quiz score per user/site/practice route.

Columns:

- `id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY`
- `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `site TEXT NOT NULL`
- `practice_path TEXT NOT NULL`
- `score INTEGER NOT NULL`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`

Constraints:

- `UNIQUE (user_id, site, practice_path)`
- `score >= 0 AND score <= 100`

Indexes:

- `idx_practice_scores_user_id`
- `idx_practice_scores_user_id_site`

RLS:

- Users can select, insert, update, and delete only rows where `auth.uid() = user_id`.

### 13.4 Timestamp Triggers

Function:

- `public.update_updated_at_column()`

Applied to:

- `progress`
- `practice_scores`

Purpose:

- Refresh `updated_at` on updates.

## 14. Site and Path Identity

Site identity:

- `window.getCurrentSite()` returns the full hostname for production `raushansync.com` domains.
- Localhost and `127.0.0.1` normalize to `maths.raushansync.com`.
- `raushansync-maths.pages.dev` also normalizes to `maths.raushansync.com`.
- Other hostnames fall back to their actual hostname.

Path identity:

- `window.getCurrentPath()` returns `pathname + search + hash`.
- `window.normalizePath(path)` only accepts same-origin paths.
- Normalized stored path is capped at 500 characters.

Why this exists:

- The codebase appears designed to support multiple RaushanSYNC subject domains with shared schema structure.
- `site` prevents progress from one domain from colliding with another.
- Local development maps to the production science site key so test data aligns with production route identity.

## 15. Progress and Completion Architecture

Completion state lives in Supabase `progress`.

Item types:

- `article`: notes, video lessons, solution pages, and other learning content.
- `practice`: standard/advanced/concept practice pages.

Page integration:

- Add a tick container:

```html
<div id="note-tick" data-tick-container data-tick-position="header" data-tick-type="article"></div>
```

- Include:

```html
<script src="/assets/js/progress-tracker.js"></script>
<script src="/assets/js/tick-manager.js"></script>
```

Tick data attributes:

- `data-tick-container`: marks mount point.
- `data-tick-position`: `header`, `section`, `item`, or default `inline`.
- `data-tick-class`: optional custom class.
- `data-tick-site`: optional explicit site key.
- `data-tick-path`: optional explicit item path.
- `data-tick-type`: `article` or `practice`.

Dashboard aggregation:

- Article count queries `progress` where `item_type='article'` and `completed=true`.
- Practice count queries `progress` where `item_type='practice'` and `completed=true`.
- Recent activity palettes query latest completed rows by item type, current user, and current site.

## 16. Quiz and Practice Architecture

Quiz card contract:

- `.quiz-card` is the root of a question.
- `data-type` may be `mcq`, `mcq-multiple`, `tf`, or `subjective`.
- `data-answer` contains the correct answer key for auto-scored questions.
- `data-reason` may contain explanatory text for AI context or feedback.
- `.quiz-btn:not(.discuss-ai-btn)` is the answer/check button.
- `.discuss-ai-btn` opens AI tutor context.
- `.quiz-feedback` displays local correctness state.
- `.quiz-answer` may hold hidden answer/explanation content.

Practice page local scripts:

- Most practice pages include inline logic for answer checking, AI context extraction, question IDs, and AI button visibility.
- The shared score handler adds final score submission/persistence.

AI context contract from practice pages:

- `practiceTitle` or `quizTitle`
- `questionText`
- `userAnswer`
- `correctAnswer`
- `explanation`
- `pageUrl`

Score persistence:

1. Student answers one or more auto-scored cards.
2. Student clicks submit.
3. `quiz-score-handler.js` computes score.
4. It inserts/updates `practice_scores`.
5. It marks the current page complete in `progress`.

Current score semantics:

- `practice_scores` keeps latest score only because of `UNIQUE (user_id, site, practice_path)`.
- There is no attempt history table in the current schema.

## 17. Dashboard Architecture

Dashboard initialization:

1. `DOMContentLoaded` sets up modal handlers and critical settings handlers.
2. `initializeDashboardWithTimeout()` starts dashboard load and clears the 15 second timeout afterward.
3. Dashboard gets the current Supabase session.
4. Missing session redirects to `/login`.
5. Current user and profile are loaded.
6. Profile fields are rendered.
7. `?edit-profile=1` or `#profileSection` opens the profile editor automatically.
8. Progress stats are loaded.
9. Progress palettes are initialized.
10. Profile status is computed.
11. Loading state is hidden and dashboard content is shown.

Dashboard data:

- Profile card:
  - Full name
  - Email
  - Phone
  - Education level
- Account status:
  - Complete/incomplete based on full name, email, education level, phone.
- Progress counters:
  - completed articles
  - completed practices
- Recent activity:
  - latest completed article paths
  - latest completed practice paths

Dashboard AI:

- Opens the shared AI chat in `student-support` mode.
- Hides context.
- Uses a generic student guidance prompt covering academics, exams, career, motivation, time management, college issues, productivity, and support.

Critical account settings:

- UI requires:
  - Press proceed button.
  - Type `DELETE`.
  - Check a confirmation checkbox.
  - Wait 15 seconds.
  - Confirm browser modal.
- Client sends authenticated `DELETE` request to account deletion endpoint candidates.
- Relative `/api/account/delete` is tried first.
- Absolute Worker URL fallback is used when relative endpoint is unavailable or forbidden by static host.
- On success, client clears local auth state, Supabase storage keys, sensitive caches, tick state, and redirects to login.

Deprecated dashboard code:

- Some learned-hours/activity tracking functions remain but comments indicate that learned hours were removed/replaced by progress stats.

## 18. AI Assistant Architecture

### 18.1 Browser AI Runtime: `ai-chat.js`

Primary responsibility:

- Shared modal UI and request client for AI support.

Modes:

- `quiz-assistant`
- `student-support`

Default config:

- Mode: `quiz-assistant`
- Title: `Ask RaushanSYNC AI Tutor`
- Context visible.
- Greeting and placeholder are quiz-oriented.

Student-support config:

- Used by homepage and dashboard.
- Context hidden.
- Greeting and placeholder are broader student-support oriented.

UI contract:

Each page using AI must provide this modal shell:

```html
<div id="ai-chat-modal" class="ai-chat-modal" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="ai-chat-title">
  <div class="ai-chat-overlay" data-ai-chat-close></div>
  <section class="ai-chat-panel">
    <header class="ai-chat-header">
      <h2 id="ai-chat-title">Ask RaushanSYNC AI Tutor</h2>
      <button id="ai-chat-close" class="ai-chat-close" type="button" aria-label="Close AI chat">x</button>
    </header>
    <div id="ai-chat-context" class="ai-chat-context" aria-live="polite"></div>
    <div id="ai-chat-history" class="ai-chat-history" aria-live="polite"></div>
    <form id="ai-chat-form" class="ai-chat-input-row">
      <label for="ai-chat-input" class="ai-chat-label">Ask a follow-up</label>
      <textarea id="ai-chat-input" rows="2"></textarea>
      <button id="ai-chat-send" type="submit">Send</button>
    </form>
  </section>
</div>
```

Request payload:

```json
{
  "message": "student message",
  "context": {
    "practiceTitle": "topic",
    "questionText": "question",
    "userAnswer": "student answer",
    "correctAnswer": "correct answer",
    "explanation": "explanation",
    "pageUrl": "current page"
  },
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "mode": "quiz-assistant"
}
```

Auth:

- Extracts Supabase access token via `window.getCurrentSession()` or direct Supabase client fallback.
- Sends `Authorization: Bearer <token>`.

Origin precheck:

- Client allows localhost, `127.0.0.1`, `*.raushansync.com`, and `null` file previews.
- The Worker itself does not accept arbitrary/null origins, so local HTTP server previews are the reliable way to test AI.

Markdown rendering:

- Escapes HTML.
- Supports inline code, bold, italic, strikethrough, unordered lists, ordered lists, and paragraphs.
- Does not render raw HTML from the model.

### 18.2 Worker AI Runtime: `worker.js`

Allowed origins:

- Exact `https://maths.raushansync.com`.
- Any HTTPS host equal to `raushansync.com` or ending in `.raushansync.com`.
- Local HTTP origins for `localhost` and `127.0.0.1`.

CORS:

- Methods: `POST`, `DELETE`, `OPTIONS`.
- Headers: `Content-Type`, `Authorization`.
- `Vary: Origin`.
- `Access-Control-Max-Age: 86400`.

Routes:

- `POST /`: AI tutor.
- `DELETE /api/account/delete`: account deletion.
- `OPTIONS *`: CORS preflight.
- Everything else: `404`.

Auth:

- Requires bearer token.
- Verifies token against Supabase `/auth/v1/user` with the publishable key.
- Returns:
  - `401` for missing/invalid token.
  - `503` for auth service unavailable or worker misconfiguration.

Rate limiting:

- In-memory isolate-local `Map`.
- Bucket key:
  - AI: `userId:clientIp`
  - account deletion: `account-delete:userId:clientIp`
- Window: 60 seconds.
- Limit: 20 requests.
- Over limit: `429` with `Retry-After`.

Model routing:

- `quality`: `llama-3.3-70b-versatile`
- `fast`: `llama-3.1-8b-instant`
- `longContext`: `qwen/qwen3-32b`
- Default: fast.
- Fallback: longContext if default receives upstream 429.
- Legacy aliases are normalized:
  - `llama3-70b-8192`
  - `llama3-8b-8192`
  - `mixtral-8x7b-32768`

Prompt construction:

- Student-support prompt covers broad student help.
- Quiz-assistant prompt adapts to inferred learner level and focuses on the provided question context.
- Learner level is inferred from class/grade terms in title/question/page URL.
- History is normalized to the last 10 user/assistant messages.

Groq call:

- Endpoint: `https://api.groq.com/openai/v1/chat/completions`
- Temperature: `0.4`
- `max_completion_tokens`: `500`
- Upstream failures are logged server-side and returned as sanitized `502` messages.

## 19. Account Deletion Architecture

Client entry:

- Dashboard critical settings panel.

Worker route:

- `DELETE /api/account/delete`

Required Worker configuration:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` secret

Auth sequence:

1. CORS origin must be allowed.
2. Bearer token must exist.
3. Bearer token is verified with Supabase Auth user endpoint.
4. Rate limit is applied.
5. Worker builds Supabase admin config.

Deletion sequence:

1. Revoke Supabase user sessions using admin logout endpoint.
2. Delete Supabase auth user.
3. Best-effort delete related table rows.

Cleanup targets:

- Required:
  - `progress.user_id`
  - `practice_scores.user_id`
  - `profiles.id`
- Optional legacy/future tables:
  - `completed_articles.user_id`
  - `practice_history.user_id`
  - `saved_resources.user_id`
  - `subscriptions.user_id`

Optional table behavior:

- Missing relation code `42P01` is ignored for optional tables.

Response contract:

```json
{
  "success": true,
  "message": "Account deleted successfully."
}
```

Failure responses:

- `401` unauthorized.
- `429` too many requests.
- `500` unable to delete account.
- `503` service/config/auth unavailable.

## 20. PWA and Service Worker Architecture

Manifest:

- `id`: `/`
- `name`: `RaushanSYNC Maths`
- `short_name`: `RS Maths`
- `start_url`: `/`
- `scope`: `/`
- `display`: `standalone`
- `orientation`: `any`
- Related Play application:
  - `com.raushansync.science`
- Icons:
  - `/icons/icon-192.png`
  - `/icons/icon-512.png`
- Screenshots:
  - six portrait screenshots
  - one wide landscape screenshot

Service worker version:

- `CACHE_VERSION = 'app-v1.0.8'`
- `CORE_CACHE = 'rs-core-' + CACHE_VERSION`
- `RUNTIME_CACHE = 'rs-runtime-' + CACHE_VERSION`
- `OFFLINE_URL = '/offline/'`
- `MAX_RUNTIME_ENTRIES = 60`

Install:

- Opens core cache.
- `addAll(CORE_ASSETS)`.
- Calls `self.skipWaiting()`.

Activate:

- Deletes old caches not matching current core/runtime names.
- Calls `self.clients.claim()`.

Sensitive document paths:

- `/login`
- `/signup`
- `/dashboard`
- `/password-reset`
- `/reset-confirmation`
- protected practice routes

Fetch routing:

- Non-GET: ignored.
- Cross-origin: ignored.
- Navigation/document:
  - sensitive/protected documents use network-only with no-store and offline fallback.
  - other documents use network-first with cache fallback and offline fallback.
- Static assets/components/notes/practice/video content:
  - cache-first.
- Other same-origin GET requests:
  - cache-first.

Cache response rule:

- Only `status === 200` and `response.type === 'basic'` are cached.

Runtime trimming:

- Deletes oldest cache entries recursively until under `MAX_RUNTIME_ENTRIES`.

Security caching posture:

- Auth pages and protected practice/dashboard documents are intentionally not served from persistent cache as primary strategy.
- Sensitive route cache entries are also cleared on sign out when possible.

## 21. Worker Configuration and Secrets

`wrangler.jsonc` contains:

- Worker schema pointer.
- `name: quiz-ai-tutor`
- `main: worker.js`
- `compatibility_date: 2026-04-15`
- Public vars:
  - `SUPABASE_URL`
  - `SUPABASE_PUBLISHABLE_KEY`
- Observability config.

Required secrets:

- `GROQ_API_KEY`
- `SUPABASE_SECRET_KEY`

Configure secrets:

```bash
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put SUPABASE_SECRET_KEY
```

Local Worker:

```bash
npx wrangler dev
```

Deploy Worker:

```bash
npx wrangler deploy
```

## 22. SEO, Discovery, and App Linking

SEO:

- Public pages include canonical URLs, meta descriptions, Open Graph metadata, and Twitter metadata.
- Many content pages include JSON-LD for articles/quizzes/breadcrumbs.
- Practice pages may use `noindex` when the content is meant for signed-in use or not public search.

Sitemap:

- `sitemap.xml` includes homepage, about, account deletion, class pages, Class 6 Chapter 1 content, and Class 7 Chapter 1 notes/core concept pages.
- Sitemap comments identify actively worked-on and less-active page groups.

Robots:

- Allows all crawling.
- Points to production sitemap.
- Includes comments for sibling subject domains.

Open Graph:

- Shared OG image lives at `assets/og/og-image.jpg`.
- Some references use `/assets/og/og-image.jpg`.
- `index.html` currently has a Twitter image reference to `/assets/images/og-image.jpg`, while the repository contains `assets/og/og-image.jpg`. This should be checked when auditing social previews.

Android App Links:

- `.well-known/assetlinks.json` delegates URL handling to `com.raushansync.science` with two SHA-256 fingerprints.

## 23. Local Development

No build is required for the static frontend.

Recommended local static server:

```bash
npx live-server .
```

or:

```bash
python -m http.server 8000
```

Why a server matters:

- Auth redirect URLs depend on an HTTP origin.
- Service workers require secure context rules; localhost is allowed by browsers.
- AI client/Worker origin checks are designed for localhost/127.0.0.1 and production-like RaushanSYNC domains.
- Opening files directly can produce `Origin: null`, which is not a reliable AI testing mode.

Install Node dependencies:

```bash
npm install
```

Smoke checks:

```bash
npm test
```

Equivalent:

```bash
npm run smoke
```

## 24. Quality Gates and CI

Package scripts:

- `npm run smoke`
  - `node --check ai-chat.js`
  - `node --check service-worker.js`
  - `node scripts/validate-core-assets.mjs`
- `npm test`
  - alias for smoke.

Core asset validator:

- Reads `service-worker.js`.
- Extracts `CORE_ASSETS`.
- Normalizes `/` to `/index.html`.
- Normalizes trailing-slash URLs to `.../index.html`.
- Fails if any listed core asset is missing.

GitHub Actions:

- Workflow: `.github/workflows/smoke.yml`
- Trigger: push and pull_request.
- Runtime: Ubuntu latest.
- Node version: 22.
- Steps:
  - checkout
  - setup Node with npm cache
  - `npm ci`
  - `npm test`

Current test coverage limit:

- Smoke checks validate only syntax for two JS files and service-worker core asset integrity.
- They do not validate HTML script ordering, CSS syntax, Supabase queries, Worker behavior, auth redirects, or AI flow.

## 25. Security Architecture

Implemented controls:

- Supabase RLS on all persistence tables.
- Frontend auth guard for protected UX routes.
- Same-origin redirect sanitization.
- No-store meta tags on auth pages and some protected pages.
- Service worker network-only treatment for sensitive documents.
- Sensitive cache cleanup on sign out/account deletion.
- Worker origin allowlist.
- Worker bearer-token verification through Supabase.
- Worker per-user/IP in-memory rate limiting.
- Worker-side Groq secret isolation.
- Worker-side Supabase admin secret isolation for account deletion.
- Sanitized AI upstream error responses.
- AI markdown renderer escapes HTML before formatting.

Important caveats:

- Frontend route protection is not a security boundary by itself. RLS and Worker token verification are the actual data/API boundaries.
- Worker rate limiting is in-memory per isolate; it is useful but not globally distributed.
- There is no comprehensive CSP documented/enforced across all pages.
- Third-party CDN scripts do not currently show SRI attributes in the inspected pages.
- Some practice pages load score handler before auth-config, creating a runtime ordering risk.
- A few content pages show mojibake sequences such as `â€“`, suggesting encoding cleanup may be needed.

## 26. Performance Architecture

Performance strengths:

- Static HTML delivery.
- No framework hydration cost.
- Shared CSS and JS modules are browser-cacheable.
- Service worker pre-caches core assets and caches runtime content.
- Cloudflare Worker keeps AI API near the edge.
- Dynamic fragments are small HTML files.

Performance costs:

- Many pages include inline CSS/JS, increasing per-page size and maintenance cost.
- `script.js` fetches components at runtime, which adds network requests on cold loads.
- Multiple pages duplicate service worker registration.
- Large global CSS file is loaded everywhere, including small auth/legal pages.
- Practice pages include page-specific answer-checking code in each HTML document.

Practical guidance:

- Keep new shared behavior in `assets/js/` rather than duplicating inline scripts.
- Keep content pages static and cacheable.
- Add new routes to `CORE_ASSETS` only if they are important offline-first pages.
- Increment `CACHE_VERSION` whenever service-worker core asset behavior changes.

## 27. Reliability and Failure Modes

Auth unavailable:

- Auth pages show authentication service unavailable.
- Dashboard shows an error and does not reveal protected content.

Auth timeout:

- `auth-guard.js` adds `auth-error` after 10 seconds if auth-ready is not reached.

Unauthenticated protected route:

- Redirects to `/login?redirect=<safe path>`.

AI missing token:

- Client shows sign-in guidance.

AI origin unsupported:

- Client blocks before request or Worker returns `403`.

AI provider unavailable:

- Worker returns sanitized `502`.
- Client shows a readable error.

Supabase token verification unavailable:

- Worker returns `503 Authentication service unavailable`.

Account deletion relative endpoint missing:

- Dashboard tries absolute Worker URL fallback.

Offline navigation:

- Non-sensitive documents try network-first, then cache, then `/offline/`.
- Sensitive/protected documents use network-only and then `/offline/` fallback.

## 28. Adding New Content Pages

For a public notes page:

1. Place it under `notes/<class>/<chapter>/index.html` or a nested concept route.
2. Include canonical, meta description, OG metadata, icons, manifest, CSS.
3. Use the shared header and footer mounts.
4. Add a notes header and breadcrumbs.
5. Add a tick container with `data-tick-type="article"` if completion tracking is wanted.
6. Load Supabase, auth-config, auth-guard, progress-tracker, tick-manager, and script.js in a safe order.
7. Add sitemap entry if public/searchable.
8. Add service-worker core asset entry only if offline-first availability is required.
9. Run `npm test`.

For a protected practice page:

1. Place it under `practice/`, `practice-advanced/`, or a nested `/practiceN/` route.
2. Include `auth-pending` early if needed to avoid protected-content flash.
3. Use `.quiz-card` markup and `data-answer` for auto-scored questions.
4. Add `.discuss-ai-btn` only where AI question context is available.
5. Include the AI modal shell if loading `ai-chat.js`.
6. Include progress and tick modules.
7. Include `quiz-score-handler.js` after `auth-config.js` or guard `window.logEvent`.
8. Add no-store/noindex metadata if the page is protected.
9. Test signed-out redirect, signed-in scoring, progress marking, previous score display, and AI.

For a class landing page:

1. Add or update the relevant `classNN/index.html`.
2. Use card-grid chapter cards.
3. Use disabled buttons for unavailable content.
4. Link active notes/practice/video pages with absolute site-root paths.
5. Update sitemap if the page should be discoverable.

## 29. Adding New Shared JS

Preferred pattern:

- Put reusable code in `assets/js/<module>.js`.
- Expose a namespaced global such as `window.FeatureName`.
- Make initialization idempotent using data attributes or internal state.
- Wait for `DOMContentLoaded` if touching DOM.
- Wait for `window.whenAuthReady()` if reading session state.
- Treat `window.supabaseClient` as optional and handle unavailable state.
- Guard optional helpers such as `window.logEvent`.
- Avoid assumptions that every page has every modal, container, or form.

Script ordering guidance:

1. Supabase CDN.
2. `/assets/js/auth-config.js`.
3. Feature modules that need auth/progress globals.
4. `/assets/js/script.js`.
5. `/assets/js/auth-guard.js`.
6. `/ai-chat.js` when AI modal is present.
7. Page-specific inline initialization.

Some current pages vary from this order. New pages should prefer the safer contract above.

## 30. Deployment Runbook

Static site:

1. Run `npm test`.
2. Commit static/doc/source changes.
3. Push to the static hosting pipeline.
4. Verify homepage, class pages, dashboard redirect, and one content route.

Worker:

1. Ensure secrets exist:
   - `GROQ_API_KEY`
   - `SUPABASE_SECRET_KEY`
2. Validate config:

```bash
npx wrangler deploy --dry-run
```

3. Deploy:

```bash
npx wrangler deploy
```

4. Verify:
   - `OPTIONS /` from production origin returns CORS headers.
   - Signed-in `POST /` AI request works.
   - Account deletion endpoint is reachable but only tested carefully with a disposable user.

Service worker:

1. Update `CORE_ASSETS` when offline core changes.
2. Increment `CACHE_VERSION`.
3. Run `npm test`.
4. Verify install/activate in browser devtools.
5. Check offline fallback and sensitive-route behavior.

Database:

1. Apply `database/schema.sql` only to fresh or intentionally migrated Supabase projects.
2. Confirm RLS is enabled.
3. Confirm policies reference `auth.uid()`.
4. Confirm triggers exist.
5. Test profile sync, progress toggle, score save, dashboard queries.

## 31. Known Maintenance Notes

Current notable constraints:

- `signup.html` and `signup/index.html` are not byte-identical. Keep compatibility copies aligned deliberately.
- `login.html` and `login/index.html` are byte-identical at the time of review.
- `components/support-cta.html` is structurally present but empty.
- Some pages register the service worker inline even though `script.js` also registers it.
- `quiz-score-handler.js` should guard `window.logEvent` or be loaded after `auth-config.js`.
- `ProgressTracker.getPracticeScore()` should distinguish `0` from `null`.
- Subjective quiz cards should be excluded from score denominator or given a separate scoring contract.
- Global CSS is large and mixed-scope; new page-specific styles should be tightly scoped.
- Social preview image paths should be audited for `/assets/images/og-image.jpg` vs `/assets/og/og-image.jpg`.
- Content encoding should be audited where mojibake appears.
- Add integration tests for auth redirects, practice score save, progress tick toggle, and Worker AI request.

## 32. Quick Reference

Production:

- Site: `https://maths.raushansync.com`
- Worker: `https://quiz-ai-tutor.raushanguptaicloud.workers.dev/`
- Account deletion fallback: `https://quiz-ai-tutor.raushanguptaicloud.workers.dev/api/account/delete`

Critical files:

- `index.html`
- `dashboard/index.html`
- `assets/css/style.css`
- `assets/js/auth-config.js`
- `assets/js/auth-guard.js`
- `assets/js/script.js`
- `assets/js/homepage-hero.js`
- `assets/js/progress-tracker.js`
- `assets/js/tick-manager.js`
- `assets/js/quiz-score-handler.js`
- `ai-chat.js`
- `service-worker.js`
- `worker.js`
- `database/schema.sql`
- `wrangler.jsonc`
- `scripts/validate-core-assets.mjs`

Critical commands:

```bash
npm test
npx wrangler dev
npx wrangler deploy --dry-run
npx wrangler deploy
```
