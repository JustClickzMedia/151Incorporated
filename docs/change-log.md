# Change Log

## 2026-10-26 — Phase 1 discovery (read-only)

- **Branch:** none yet. The repo wasn't accessible; the plan is to commit on `chore/backend-graphql-audit`.
- **Files added:** `docs/backend-audit.md`, `docs/project-status.md`, `docs/change-log.md`
- **WordPress/production changes:** none
- **Reason:** first deliverable. Audit the backend before any installation.
- **Testing:**
  - Anonymous REST via `rest_route`: OK
  - Pretty `/wp-json/`: 404
  - GraphQL via `/index.php?graphql`: OK
  - Anonymous introspection: blocked
  - Anonymous user enumeration: exposed
- **Outstanding issues:** blockers B1–B6 in `backend-audit.md`
- **Follow-up, same day:** with owner approval I investigated the `/wp-json/` outage. I confirmed the weekly HostGator backup from 2026-10-26 00:58 EDT exists, and read `.htaccess` (no changes; it's correct). A re-test found the REST API healthy, so **no production change was made**. The homepage still fails because of the missing page 13 (B2).
- **Next steps (original):** owner review → production REST fix (approval) → backups → staging

## 2026-10-28 — Phase 1 docs committed

- **2026-10-28** · branch `chore/backend-graphql-audit` · files added: `docs/backend-audit.md`, `docs/change-log.md`, `docs/project-status.md` (local commit only; not pushed)
- **Update:** Kenneth later pushed these files, and they are now on `master`.

## 2026-10-28 — Staging created and GraphQL hardening (staging only)

- **Branch:** `chore/backend-graphql-hardening` (uploaded through the GitHub web UI)
- **Environment:** staging `https://tzin.brothersof1-5-1.org/staging/1848`. **No production settings were changed.**
- **Changes on staging:**
  1. Created staging with the HostGator Staging tool.
  2. ACF post types:
     - Events GraphQL names `events/events` → `event/events`.
     - Homepage Carousel plural `homepageCarousel` → `homepageCarousels`.
  3. WPGraphQL: query depth limit on (15). "Delete data on deactivation" off.
  4. Simple JWT Login: CORS off.
  5. New mu-plugin `wp-content/mu-plugins/bo151-api-hardening.php`, which hides users from anonymous visitors and adds the CORS allow-list.
- **Files added to the repo:**
  - `wordpress/mu-plugins/bo151-api-hardening.php`
  - `docs/graphql-contract.md`
  - `docs/ANGULAR-HANDOFF.md` (start here for Claude Desktop)
  - `docs/wordpress-operations.md`
  - `docs/security-architecture.md`
- **Files updated:** `docs/change-log.md`, `docs/project-status.md`
- **Testing (anonymous, staging):**
  - Pages, carousels, events and posts queries work.
  - Users: `[]`.
  - REST users: 404.
  - Drafts: `[]`.
  - Depth 15 enforced.
  - Allowed origin OK; other origin blocked.
  - REST pages still 200.
  - No new PHP errors.
- **Side effect noted:** the HostGator plugin appears to have been switched on in production when the Staging tool was opened.
- **Outstanding:** homepage slug decision; promotion to production (approval needed); batching and caching decisions; disable REST for New Prospects.
- **Next steps:** owner review → Angular builds against the staging contract → promote to production. → production REST fix (approval) → backups → staging

## 2026-10-28 — Angular Task 1: API URLs moved into environment config

- **Branch:** `feature/angular-graphql-migration` (from `chore/backend-graphql-hardening`)
- **Files changed:**
  - `src/environments/environment.ts`: adds `graphqlUrl` and `restUrl` (staging `/staging/1848/`)
  - `src/environments/environment.prod.ts`: adds `graphqlUrl` and `restUrl` (production). GraphQL isn't called yet
  - `src/app/Services/wordpress.service.ts`: `baseUrl` now reads `environment.restUrl`; the hard-coded `wp-json` URL is removed
  - `angular.json`: the production build now swaps in `environment.prod.ts`. There was no `fileReplacements` before, so `environment.prod.ts` was never used
  - `src/app/Services/wordpress.service.spec.ts`: tests the URL source and that REST calls are unchanged
- **Behavior:** production builds still call production REST, as before. `ng serve` (development) now calls staging REST. REST code paths are unchanged. No GraphQL calls yet.
- **Tested:**
  - `ng build` (production) and `ng build --configuration development` both succeed.
  - The production bundle contains only production URLs; the development bundle contains only staging URLs.
  - `ng test`: 12 pass / 11 fail. The baseline before this change was 7 / 12.
  - The 11 remaining failures already existed: component specs are missing `HttpClient`/router test providers.
  - The build was verified with font inlining off, because the build sandbox can't reach `fonts.googleapis.com`.
  - Nothing was tested against the live staging endpoint (the build sandbox can't reach it).
- **Open issues:**
  - The 11 component specs that already fail.
  - `.angular/cache` is tracked in git; it should be ignored.
  - Prerendering calls WordPress REST at build time.
  - Homepage slug is TBD (Task 2).
  - The Angular upgrade (17 → 22) is next, per the owner.

## 2026-10-28 — Angular upgrade 17.3 → 22.2 (version steps + control flow)

- **Branch:** `feature/angular-graphql-migration`
- **Commits:** one per major version (18, 19, 20, 21, 22), plus:
  - one commit to untrack `.angular/cache`
  - one commit for the `@if`/`@for` control-flow migration
- **Files changed:**
  - Dependencies: `package.json` and `package-lock.json`
  - Config: `angular.json` (generation defaults), `tsconfig*.json`, `.gitignore`
  - Server and bootstrap: `server.ts`, `src/main.ts`, `src/main.server.ts`, `src/app/app.config*.ts`
  - Components: every `src/app/Components/*/*.component.ts`, plus 6 component templates
  - Tests: all spec files (`async` → `waitForAsync`)
- **Notable fixes needed during the upgrade:**
  - 3 components imported the test-only `async` helper (removed in v18).
  - The navbar `@HostListener` passed an unused `$event` (an error in v21).
  - `@types/node` had to move to ^22.12 (a vite peer requirement).
  - `@fortawesome/angular-fontawesome` was stepped 0.14 → 5.1, one version per Angular major.
  - SSR `CommonEngine` now needs `allowedHosts`. Without it, every SSR request returned 500.
- **Behavior kept on purpose (until the architecture step):**
  - zone.js change detection (`provideZoneChangeDetection()`)
  - `ChangeDetectionStrategy.Eager` on components (v22 defaults to OnPush)
  - No incremental hydration
  - Karma as the test runner
  - `@angular-devkit/build-angular` builders
- **Tested at every step:**
  - Production and development builds succeed (font inlining was off in the sandbox only).
  - Production bundle → production URLs; development bundle → staging URLs.
  - `ng test` in headless Chromium: 15 pass / 8 fail at v22, up from 12/11. The 8 remaining failures already existed (missing `ActivatedRoute`/router test providers).
  - SSR server smoke test: `/` and `/pg/...` return 200; a non-allow-listed host is rejected.
  - `package-lock.json` installs with both npm 10 and npm 11 (`npm ci`).
- **Not tested:** live staging calls (the sandbox can't reach the staging host); a manual browser check.
- **Open issues:**
  - The 8 component specs that already fail.
  - Prerendering calls WordPress at build time.
  - The `HomebuttonsectionComponent` import is unused.
  - The SSR host list may need the real deploy hostname.
  - Next: inject()/signals, zoneless, Vitest, and the `@angular/build` builder.

## 2026-10-28 — Architecture step 1: inject() + signals

- **Branch:** `feature/angular-graphql-migration`
- **Commits:**
  - `refactor: constructor injection -> inject()` (Angular's migration)
  - `refactor: component state to signals`
- **Files changed:**
  - Components: `presidents`, `sidbarposts`, `navbar`, `pagedetails`, `postdetails`, `searchresults` (`.ts` and `.html` for each)
  - New: `src/app/Services/rx-fallback.ts`
  - Services: `seo.service.ts`, `wordpress.service.ts` (`inject()` only)
  - Specs: app, details, presidents, navbar, pagedetails, postdetails, searchresults
- **Behavior:**
  - Same REST calls, same rendered output.
  - Detail and search pages now make one request per route change; before, they made two on load.
  - Route subscriptions are now cleaned up automatically.
  - Errors are logged and the section stays empty, as before.
- **Tested:**
  - Production and development builds succeed.
  - `ng test`: **30/30 pass** (was 15/8). New behavior tests cover:
    - Rendering from mocked REST.
    - Re-fetching when the route param changes.
    - The 404 fallback (page 13). A mutation check confirmed this test fails if the fallback is removed.
    - Menu rendering and toggling.
  - SSR returns 200 for `/`, `/pg/…`, `/pst/…` and `/search/…`.
- **Not tested:** live staging/production REST from the sandbox; a manual browser check.
- **Open issues:**
  - Change detection is still `Eager` + zone.js. That's the next step (zoneless).
  - Homepage still uses page ID 13 (Task 2).

## 2026-10-28 — Angular Task 2: homepage loaded by slug (not page ID 13)

- **Branch:** `feature/angular-graphql-migration`
- **Files changed:**
  - `src/environments/environment.ts` and `environment.prod.ts`: new `homepageSlug: ''`, with a TODO for when the homepage is chosen
  - New `src/app/homepage.config.ts`: a `HOMEPAGE_SLUG` token that defaults to `environment.homepageSlug`
  - `src/app/Services/wordpress.service.ts`: new `getPageBySlug()` (REST `pages?slug=…&_embed`). The GraphQL `page(id: $slug, idType: URI)` comes with the GraphQL client (Task 4)
  - `src/app/Components/presidents/presidents.component.ts`: loads the page by slug. With an empty slug it makes no request
  - Specs: `presidents.component.spec.ts`, `wordpress.service.spec.ts`
- **Behavior:**
  - The `pages/13` request (404 `rest_post_invalid_id`) is gone.
  - With no slug set, the homepage shows its static sections ("God Before All", Strategic Objectives, News & Upcoming Events), the same as it looks today.
  - `getPage(id)` is unchanged, because the `pg/:id/:title` route still uses it until Task 3.
- **Tested:**
  - Production and development builds succeed.
  - `ng test`: **35/35 pass**. Tests cover:
    - No page request when the slug is empty.
    - Slug lookup and render, including the "Continue Read More" link.
    - Slug not found.
    - Request failure.
  - No `pages/13` reference remains in the source.
- **Open issues:** Kenneth to choose the homepage slug. Candidates: `membership`, `president`, `about-1-5-1`, `moto`, `scholarship`, `foundation`.

## 2026-10-28 — Angular Task 3: page route by slug (`pg/:slug`)

- **Branch:** `feature/angular-graphql-migration` (adds to PR #7)
- **Files changed:**
  - `src/app/app.routes.ts`: new `pg/:slug` route; the old `pg/:id/:title` route now goes through a redirect guard; new `404` route
  - New `src/app/legacy-page-redirect.guard.ts`: looks up the old page ID (REST `pages/<id>?_fields=slug`) and redirects to `/pg/<slug>`, replacing the old URL in history. Unknown IDs (such as 13) show the 404 view without changing the address bar
  - `src/app/Services/wordpress.service.ts`: new `getPageSlugById()`. `getPage(id)` is kept but no longer used
  - `src/app/Components/pagedetails/*`: loads the page by slug with `getPageBySlug()`. No match shows the 404 view. Request failures are logged and the section stays empty, as before. Pages without a featured image no longer cause a template error
  - Links now use slugs:
    - Navbar: `['/pg', slug]`
    - Carousel History slide: `/pg/about-1-5-1`
    - Home buttons: `/pg/membership`, `/pg/president` (was page 13, which doesn't exist), `/pg/scholarship`
    - "Continue Read More" (`linkcss` pipe): `/pg/<slug>`
  - `carousel`, `homebuttonsection` and `pagenotfound` now import `RouterLink`. Their links previously rendered without an `href`
  - Specs: new guard spec; updated pagedetails, navbar, presidents, carousel, homebuttonsection, home, pagenotfound, linkcss and the service
- **Slug map (production and staging match):** 29 `membership`, 27 `president`, 19 `about-1-5-1`, 17 `moto`, 15 `scholarship`, 10 `foundation`
- **Tested:**
  - `ng test`: **45/45 pass**.
  - Mutation checks: removing the 404 view, or removing `skipLocationChange`, each makes a test fail.
  - Development build succeeds. Production build succeeds with font inlining turned off locally: the sandbox gets a 403 from Google Fonts, and `angular.json` is unchanged.
  - SSR returns 200 for `/`, `/pg/about-1-5-1`, `/pg/19/…`, `/pg/13/…` and `/nope`.
- **Not tested:** live WordPress calls (the sandbox can't reach the host); a manual browser check.
- **Open issues:**
  - The SSR 404 view returns HTTP 200, not 404. `server.ts` uses `CommonEngine`, which has no response-status hook.
  - If the ID lookup fails (for example, a network error), old links show the 404 view.
  - The `pst/:id/:title` post route is still ID-based.
  - The GraphQL `page(id: $slug, idType: URI)` swap comes with Task 4.
