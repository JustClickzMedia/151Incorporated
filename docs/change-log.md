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

## 2026-10-28 — Angular Task 4: GraphQL client (pages read through GraphQL on staging)

- **Branch:** `feature/graphql-client`
- **Files changed:**
  - New `src/app/Services/graphql.service.ts`: a thin `HttpClient.post(graphqlUrl, { query, variables })` client (no Apollo).
    - Sends no `Authorization` header and no cookies (`withCredentials: false`).
    - **Any `errors[]` is a failure** (`GraphqlError`), even when partial data comes back. An HTTP 500 with a GraphQL `errors` body also becomes a `GraphqlError`.
  - New `src/app/Services/wp-queries.ts`: the `PageBySlug` and `Pages` queries, copied from `graphql-contract.md`.
  - New `src/app/Model/wp-page.ts`: one `WpPage` model with REST and GraphQL mappers.
    - Components no longer read raw REST fields (`title.rendered`, `_embedded`).
    - The GraphQL `Page` type has no excerpt field, so the excerpt is built from the content (first 55 words, like WordPress).
  - `src/app/Services/wordpress.service.ts`: `getPageBySlug()` and the new `getMenuPages()` use GraphQL when `USE_GRAPHQL` is on, and REST otherwise.
    - `getPageSlugById()` (old-link redirects), posts and search stay on REST.
  - Environment flag `useGraphql`: **`true` in `environment.ts` (staging), `false` in `environment.prod.ts`.** Production stays on REST until the backend promotes staging to production.
  - `src/app/app.config.ts`: `withHttpTransferCacheOptions({ includePostRequests: true })`, so GraphQL POST responses from SSR are reused on the client instead of being fetched twice.
  - Components:
    - `pagedetails`, `presidents` and `navbar` use the `WpPage` / `WpPageLink` models.
    - The SEO description now comes from the page excerpt. The old `post-custom-fields` Keywords/Description don't exist in REST or GraphQL, so those calls only threw and logged.
  - Specs:
    - The page-details suite now runs against **both REST and GraphQL**.
    - New `graphql.service.spec.ts` and `wp-page.spec.ts`.
    - Added GraphQL cases to the navbar, presidents and service specs.
- **Tested:**
  - `ng test`: **72/72 pass**.
  - Mutation checks: ignoring `errors[]` fails 3 tests; ignoring the flag fails 12.
  - Development build succeeds. Production build succeeds (font inlining off locally, as before).
  - The production bundle has `useGraphql: false` and no staging URL.
  - **Live staging check** (exact query strings, from the browser):
    - `Pages` returns all 6 slugs, `hasNextPage` false.
    - `PageBySlug` returns all 6 pages with featured images.
    - An unknown slug returns `page: null`.
- **Browser check (2026-10-28, Kenneth):** `ng serve` on the Mac, pages load from staging GraphQL with no console or CORS errors (after the SEO fix below).
- **Open issues:**
  - Turning on GraphQL in production is one line (`useGraphql: true` in `environment.prod.ts`) after promotion.
  - The navbar now asks for up to 20 pages (REST asked for 6); there are 6 today.
  - Posts, search, events and carousel are still REST or static (Tasks 5–7).

## 2026-10-28 — Fix: SSR "op is not a function" in SeoService

- **Branch:** `feature/graphql-client`
- **Cause:**
  - `SeoService.removeMetaTags()` used selectors with spaces around `=` (`'name = "author"'`). The server-side DOM (domino) throws on these, so during SSR `applySeo()` stopped before `setTitle()`, and server-rendered pages had no page title or description.
  - It also used `httpEquiv` instead of `http-equiv`, so the Content-Type tag was never removed and was duplicated on every navigation.
- **Files changed:**
  - `src/app/Services/seo.service.ts`: `META_TAGS_TO_REMOVE` selectors with no spaces, removed with `meta.removeTag()`.
  - `src/app/Services/seo.service.spec.ts`: no duplicate tags after repeated navigations; selector format check.
  - `src/app/Components/home/home.component.ts`: removed the unused `HomebuttonsectionComponent` import (the NG8113 warning; the buttons are commented out in the template).
- **Tested:**
  - `ng test`: **74/74 pass**.
  - Development build has no NG8113 warning.
  - The old selector reproduces the error in domino; the new selectors parse.
- **Note:** the "sanitizing HTML stripped some content" warning comes from Gutenberg's `data-type` / `data-id` attributes on a link in the `president` page. Angular removes `data-*` attributes from `[innerHTML]`. The link itself still works; this is harmless.

## 2026-10-28 — Angular Task 5: homepage carousel from WordPress (GraphQL `homepageCarousels`)

- **Branch:** `feature/graphql-carousel`
- **Files changed:**
  - New `src/app/Model/carousel-slide.ts`: maps each `homepageCarousels` item to a slide.
    - Six images become a `<picture>`: five `<source>` media queries, with desktop landscape as the `<img>`.
    - Missing sizes are skipped. If the desktop landscape image is missing, the next image that exists is used.
    - `altText` falls back to the title (it's empty for all 3 items today).
  - `src/app/Services/wp-queries.ts`: the `HomepageCarousels` query from the contract (plus `mediaDetails` for `width`/`height`).
  - `src/app/Services/wordpress.service.ts`: new `getHomepageCarousels()`.
    - GraphQL only (there's no REST equivalent). It returns `[]` when `useGraphql` is off.
    - The result is cached for the session; a failed request isn't cached.
  - `src/app/Components/carousel/*`: the component has three states:
    - **WordPress slides** when GraphQL returns items.
    - **The built-in slides** (unchanged) when GraphQL is off (**production until promotion**), empty, or failed. Failures are logged.
    - **Nothing while loading**, so the built-in images aren't downloaded first.
    - The first slide isn't lazy-loaded; the others are `loading="lazy"`.
    - Indicators are generated per slide. The built-in set had 4 indicators for 5 slides; it now has 5.
  - `src/app/Services/seo.service.ts`: `removeMetaTags()` removes **every** match, cleaning up duplicates. Its spec now starts from a clean `<head>`; it had been order-dependent.
  - Specs: carousel (GraphQL on and off), `carousel-slide.spec.ts`, service carousel tests, SEO duplicates test.
- **Breakpoints** (checked in Chrome with real staging images at each viewport):

  | Viewport | Image used |
  |---|---|
  | Phone portrait (375×812) | `mobileportraitimage` |
  | Phone landscape (812×375) | `mobileLandscapeImage` |
  | Tablet portrait (768×1024) | `tabletportraitimage` |
  | Tablet landscape (1180×820, 1024×768) | `tabletlandscapeimage` |
  | Laptop (1366×768) | `desktopportraitImage` |
  | Desktop (1920×1080) | `desktopLandscapeImage` |
- **Tested:**
  - `ng test`: **88/88 pass** (3 runs).
  - Mutation checks: no active slide, or no alt fallback, each fail a test.
  - Development and production builds succeed.
  - The production SSR homepage renders the 5 built-in slides with no `<picture>` (GraphQL off).
  - The exact query works on live staging: 3 items.
- **Not tested:** the Bootstrap slide animation in a real browser with the WordPress slides.
- **Open issues / content:**
  - WordPress slides have **no captions or links**, because the type has no link field. The titles ("Brothers of 1-5-1", "The Michael J. Bryant Memorial Scholarship", "Membership Requirements") are used only as alt text. A link field would have to be added on the backend.
  - The "desktop" images are only 1024 px wide (for example `bismarck1900landscape.jpg` is 1024×576), so they look soft on large screens. Re-upload at 1920 px to fix.

## 2026-10-28 — Task 5 follow-up: live-site carousel design with responsive images

- **Branch:** `feature/graphql-carousel`
- **Finding:** the live site (brothersof1-5-1.org, Angular 17.3.1) is built from the **unmerged `Nav-changes` branch**, not `master`.
  - Its carousel is full-screen (`height: 100vh`) with captions and "Learn About…" buttons.
  - It stretches one 1296×624 image to the screen height, which is why phones showed a distorted desktop image.
  - `master` never had that design.
- **Files changed:**
  - `carousel.component.css`: the full-screen design from `Nav-changes` (100vh/100svh, dark overlay, white caption, button hover).
    - Images now use `object-fit: cover` (cropped, not stretched).
    - The caption is vertically centred, not fixed at 400px, so it stays visible on short landscape phones.
  - `carousel.component.html`:
    - WordPress slides get a caption (title) and a button.
    - The built-in slides are now the live site's 3 captioned slides.
    - Links use slugs. The live site's Membership button pointed to page 13, which doesn't exist; it now goes to `/pg/membership`.
  - New `carousel-links.ts`: button label and page slug per WordPress carousel ID (107 → `about-1-5-1`, 106 → `scholarship`, 105 → `membership`). Temporary until the carousel type gets a link field.
- **Tested:**
  - `ng test`: **90/90 pass** (captions, links, built-in slides, `object-fit: cover`).
  - Chrome at 390×844 with the real staging images: the mobile portrait image is used, cropped to fill, with the caption and button centred.
- **Open issues:**
  - The rest of `Nav-changes` isn't in `master`: navbar logo and button colours, hover styles, removed page top margin, `.img-overlay`, a `homemainimage` component and a navbar rewrite. Deploying `master` would drop those; they need to be merged on purpose.
  - Add a link field to the carousel type, then remove `carousel-links.ts`.

## 2026-10-28 — Task 5 follow-up 2: slides sized to the image, not stretched to full screen height

- **Branch:** `feature/graphql-carousel`
- **Problem:**
  - With `height: 100vh` plus `object-fit: cover`, phones got the right image (for example `BismarkMobile320X480.jpg`), but it was enlarged to fill the full screen height.
  - On a 393×852 phone, a 320×480 image was scaled about 1.8×, and both sides were cut off, so it didn't look resized.
- **Fix** (`carousel.component.css`):
  - Each slide takes the shape of that screen size's images, using the same media queries as the `<picture>` sources: 16:9 desktop, 1024:493 laptop, 4:3 tablet landscape, 601:962 tablet portrait, 3:2 phone landscape, 9:16 phone portrait.
  - Slides are capped at the screen height (`max-height: 100svh`).
  - The whole photo now shows, scaled to the screen width. `cover` only trims images whose shape differs slightly from the standard.
- **Checked live on `ng serve`** (Chrome on the Mac):

  | Viewport | Slide size | Image |
  |---|---|---|
  | 393×852 phone | 393×699 | `…mobileportrait.jpg` (360×640) |
  | 812×375 phone landscape | 812×375 | 480×320 |
  | 768×1024 tablet | 768×1024 | 601×962 |
  | 1180×820 tablet | 1180×820 | 1024×640 |
  | 1366×768 laptop | 1366×658 | 1024×493 |
  | 1920×1080 desktop | 1920×1080 | 1024×576 |
- **Tested:** `ng test` **91/91 pass** (new: slide has an aspect ratio and is no taller than the screen).
- **Content:** the phone images are only 320–360 px wide, so they look soft on 2× and 3× phone screens. Uploading phone images at about 1080×1920 and desktop images at 1920×1080 would make them sharp.

## 2026-10-28 — Task 5 follow-up 3: whole image always visible (`object-fit: contain`)

- **Branch:** `feature/graphql-carousel`
- **Problem:** with `cover`, an image whose shape differs from its slot was enlarged and cut off at the edges.
  - The Bismarck phone image is 320×480 (2:3) in the 9:16 phone slot, so it ran past the screen on both sides.
  - A slide capped at the screen height had the same problem.
- **Fix:** `object-fit: contain`. The whole image is always visible, scaled to fit. A mismatched image gets thin bars in the slide colour (#670001) instead of being cropped.
- **Checked on `ng serve`** (393×852):

  | Slide | Image | Drawn at |
  |---|---|---|
  | Scholarship | 360×640 | 393×699, fills the slot exactly |
  | Membership | 360×640 | 393×699, fills the slot exactly |
  | Bismarck | 320×480 | 393×590, full width, thin bars top and bottom |

  No horizontal overflow (`scrollWidth` 393).
- **Tested:** `ng test` **91/91 pass**.
- **Content:** re-uploading the Bismarck phone image at 9:16 (e.g. 1080×1920) removes its bars.

## 2026-10-29 — Task 5 follow-up 4: Richmond-style hero banner (dimensions + maroon tint)

- **Branch:** `feature/graphql-carousel`
- **Request:** behave like the richmondsigmas.org homepage hero. Only the behaviour and dimensions were reproduced; no assets, text or code were copied.
  - **The same wide photo on every screen** (`desktopLandscapeImage`; the per-screen `<source>`s are removed).
  - A banner with a fixed shape that gets shorter as the screen narrows: **1240:560 (≈2.2:1) from 768 px up, 480:275 (≈1.75:1) on phones**.
  - The photo is cropped from the centre (`object-fit: cover`).
  - **Maroon tint** `rgba(103,0,1,.55)`; Kenneth chose this over Richmond's blue.
  - The banner starts **below** the fixed navbar: a 146px maroon band (`border-top`) sits behind the transparent header, so it reads as a solid bar, as on Richmond.
  - Smaller caption and button on phones so they fit the shorter banner.
- **Checked on `ng serve`:**

  | Viewport | Banner |
  |---|---|
  | 393×852 | 393×225 |
  | 768 | 768×347 |
  | 1024 | 1024×462 |
  | 1366 | 1366×617 |
  | 1920 | 1920×867 |

  The banner starts at 146px at every size, and the caption sits inside it.
- **Tested:** `ng test` **91/91 pass**.
  - New: banner shape, 146px band, maroon tint, `cover`, no `<source>`s.
  - Mutation: making the banner full height fails a test.
- **Notes:**
  - The 146px matches the navbar height at the top of the page at every width. If the navbar changes (for example, the `Nav-changes` merge), update it.
  - `docs/wordpress-operations.md` now says only `desktopLandscapeImage` is used.

## 2026-10-29 — Homepage: Strategic Objectives and News on every screen size

- **Branch:** `feature/graphql-carousel`
- **Problem:** `presidents.component.html` had two copies of Strategic Objectives and News.
  - The desktop copy (`d-none d-md-block`) was inside `@if (page())`, so it only rendered once a homepage page loaded, and `homepageSlug` is still empty.
  - The mobile copy was `d-lg-none d-md-none`.
  - Result: from 768px up (tablet, laptop and desktop) neither showed.
- **Fix:** one responsive block that always renders.
  - With a homepage page: excerpt on the left (lg 6 columns), objectives and news on the right (lg 5 columns).
  - Without one: objectives and news centred (lg 8 columns).
  - Below lg: everything stacks full width.
- **Checked on `ng serve`:** Strategic Objectives and News show exactly once at 393, 768, 1024, 1366 and 1920 px, with no horizontal overflow.
- **Tested:** `ng test` **93/93 pass**.
  - New: shown once and not hidden by any `d-*-none` class, both with and without a homepage page.
  - Mutation: the old template fails both tests.

## 2026-10-29 — Navbar: regular menu on desktop (hamburger only on phones and tablets)

- **Branch:** `feature/desktop-menu`
- **Files changed:**
  - `navbar.component.html`: `navbar-expand-lg`. From 992px up, the page links and the Pay Dues and Give Back buttons show in one horizontal row next to the logo, and the hamburger is hidden. Below 992px, the hamburger menu is unchanged.
  - `navbar.component.css`, desktop only:
    - Links are white over the maroon header band and turn maroon when the header goes white on scroll (`.bgnav`).
    - The underline shows on hover and on the active page.
    - Spacing is tighter than the stacked phone menu, and tighter again at 992–1199px.
    - Outline buttons turn maroon on the white scrolled header.
  - `navbar.component.ts`: new `closeNavbar()`. Choosing a page now closes the phone menu instead of toggling it.
  - Specs: `navbar-expand-lg` present; choosing a page closes the menu.
- **Checked** (Playwright, development build, mocked WordPress data, real-size logo):
  - 992, 1024, 1280, 1366 and 1920 px: hamburger hidden, all 6 links on one row, no horizontal overflow.
  - 393 and 768 px: hamburger shown.
  - Scrolled at 1366: white header, maroon links and buttons.
- **Tested:** `ng test` **95/95 pass**.
- **Notes:**
  - Menu labels are still the page slugs in capitals (for example "ABOUT-1-5-1").
  - At 992–1199px the header is 121px tall (the logo shrinks), so the 146px banner band shows about 25px of maroon below it.
  - `ng serve` on the Mac was stopped during this check, so it wasn't re-checked there.

## 2026-10-30 — Navbar: two header looks that switch on scroll (the always-burgundy change is reverted)

- **Branch:** `feature/desktop-menu`
- Commit `453bfc9` (always-burgundy header) is reverted (`442986c`). Kenneth wants the header to switch between two looks:

  | When | Background | Logo | Links, buttons, hamburger |
  |---|---|---|---|
  | **At the very top of the page** | White | Dark-text 219×52 "Brothers of 1-5-1 Incorporated" | Maroon |
  | **Once scrolled** (`.bgnav`, added by the existing scroll handler) | Burgundy `#670001`, with shadow | White-text logo, 48px tall | White |

  This is the reverse of the old behaviour (transparent header with the white logo at the top, white header with the dark logo when scrolled).
- **Files changed:**
  - `navbar.component.css`: colours for both looks.
  - `navbar.component.html`: the dark-text logo is the starting logo.
  - `navbar.component.ts`: the scroll handler swaps the logos the other way round; the hamburger border is maroon at the top and white when scrolled.
    - **Bug fix:** the handler used `#margintransition`, which only exists on page views. On the homepage every scroll threw `Cannot read properties of null (reading 'style')`. It's now null-guarded.
  - `carousel.component.css`: the band behind the header is now **white** and **118px**, matching the white header at the top (118px at most widths, 100px at 992–1199px).
- **Checked on `ng serve`:** homepage at 1920px.
  - Top: white header, dark logo, maroon links and buttons, banner starts at 146px.
  - Scrolled: burgundy header, white logo and links.
  - Scrolling back up returns to white.
- **Tested:** `ng test` **96/96 pass** (new: both looks and logos via the scroll handler). Development build succeeds.
