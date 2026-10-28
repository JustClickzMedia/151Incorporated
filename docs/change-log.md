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
