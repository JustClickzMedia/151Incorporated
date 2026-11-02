# Runtime WordPress Content + Intelligent Caching — Phase 1 Audit and Proposed Design

**Date:** 2026-11-01 · **Branch:** `feature/runtime-content` (from `master` 4e95c42) · **Status:** audit done, design awaiting approval. No code changed yet.

Everything below was checked against the real repository, the real built output (`dist/`), and live network requests to `brothersof1-5-1.org` and `tzin.brothersof1-5-1.org` — not assumed.

---

## 1. Audit summary

### 1.1 Angular version and build

| Item | Finding |
|---|---|
| Angular | 22.2 (`@angular/core ^22.2.3`, `@angular/ssr ^22.2.5`), standalone components, signals |
| Builder | application builder with `ssr.entry = server.ts` **and `prerender: true`** |
| What is deployed | Only `dist/brotherof151/browser/` (static files) to HostGator `public_html`. The Node SSR server (`server/`) is **not** deployed. |
| Prerendered routes | `/` and `/404` (`prerendered-routes.json`). Every other route is served by `index.csr.html` through `.htaccess`. |
| Hydration | `provideClientHydration(withHttpTransferCacheOptions({ includePostRequests: true }))` |
| Service worker | None (no `@angular/service-worker`, no `ngsw-config.json`, 0 registrations on the live site) |
| CLAUDE.md | None in the repository |

### 1.2 Build-time WordPress dependency (the main finding)

The homepage is **not** fully runtime-driven today:

- At build time, prerendering of `/` calls production WordPress and stores the responses in `index.html` (`<script id="ng-state">`, 6 KB):
  - the **menu** (`pages` query: membership, president, about-1-5-1, moto, scholarship, foundation)
  - the **homepage carousel** (`homepageCarousels`, items 105–107 with image URLs)
- Because the HTTP transfer cache includes POST requests, the browser **reuses those build-time responses** when the homepage loads and makes **no GraphQL request** (confirmed live: 0 GraphQL requests on a fresh homepage load).
- The menu and carousel signals are created once per session, so a visitor who lands on the homepage keeps the **build-time menu and carousel for the whole visit**.
- Result: adding/renaming/reordering a page or changing a carousel slide in WordPress does **not** show on the homepage until Angular is rebuilt and redeployed.

Routes served by `index.csr.html` (`/pg/:slug`, `/pst/...`, search) already fetch WordPress at runtime — e.g. the `president` page edited today (2026-11-01 17:03) is live without a rebuild.

### 1.3 Existing services and queries

| File | Role |
|---|---|
| `Services/graphql.service.ts` | Thin client: `POST { query, variables }` to `environment.graphqlUrl`, no credentials, treats `errors[]` as failure |
| `Services/wordpress.service.ts` | `getMenuPages()`, `getPageBySlug()`, `getHomepageCarousels()` (GraphQL or REST via `USE_GRAPHQL`); `getPosts/getPost/getSearch/getPageSlugById` (REST only) |
| `Services/wp-queries.ts` | `PAGES`, `PAGE_BY_SLUG`, `HOMEPAGE_CAROUSELS` |
| `Services/rx-fallback.ts` | Log error, continue with a fallback value |
| Consumers | navbar (menu), carousel, presidents (homepage page, slug empty), pagedetails, postdetails, searchresults, legacy redirect guard |

Caching today: only `getHomepageCarousels()` uses `shareReplay` (session-only). No request deduplication elsewhere, no persistence, no invalidation. Loading/error UI: errors are logged and the section stays empty; no retry.

### 1.4 Content hardcoded in Angular (not from WordPress)

| Content | Where |
|---|---|
| Our History text | `history.component.html` |
| "God Before All" + Strategic Objectives | `presidents.component.html` |
| Footer: address (placeholder P.O. Box 11111), email, quick links, social links, motto | `footer.component.html` |
| 3 fallback carousel slides; carousel button label/slug per WordPress ID (105–107) | `carousel.component.html`, `carousel-links.ts` |
| Menu labels (`about-1-5-1` → About, `president` → Leadership) | `navbar.component.ts` `NAV_LABELS` |
| Pay Dues Square URL | `navbar.component.ts` `PAY_DUES_URL` |
| Default SEO tags (author, date 2018-06-02) | `seo.service.ts` |

These stay as they are in this project unless you ask to move any of them into WordPress (that would need new WordPress fields).

### 1.5 WordPress content inventory (production, live)

| Type | Items | Used by Angular |
|---|---|---|
| Pages | 6: membership, president (Leadership), about-1-5-1, moto, scholarship, foundation | Menu + `/pg/:slug` |
| Homepage Carousel | 3: IDs 105, 106, 107 (6 image sizes each) | Homepage carousel |
| Events | 1 (ID 170, "GOT SKILLZ 6 IS BACK!", modified 2026-11-01) | **Not shown anywhere** (News & Events was removed) |
| Posts | 0 | `/pst/...` and search (REST) |
| WordPress menus | 0 (the menu is built from the page list) | — |

Every content node exposes `modified` in GraphQL; `contentNodes(orderby: MODIFIED)` works publicly. Introspection is disabled for the public (good). Query depth limit is on.

### 1.6 Endpoints and hosting

- GraphQL: `https://tzin.brothersof1-5-1.org/graphql` (prod), `/staging/1848/graphql` (dev). REST: `/wp-json/wp/v2/`.
- API hardening mu-plugin is active in production: `/wp-json/wp/v2/users` → 404; CORS limited to `brothersof1-5-1.org`, `www.`, `localhost:4200`.
- Frontend: HostGator, nginx in front of Apache, static files in `public_html`.

### 1.7 HTTP caching (measured)

| Resource | Headers today | Effect |
|---|---|---|
| `index.html`, `index.csr.html` | `Last-Modified` only, **no `Cache-Control`, no ETag** | Browsers cache heuristically, so visitors can keep an **old app version** after a deploy (seen on 2026-10-30) |
| Hashed JS/CSS (`main-2LH7QNHO.js` …) | `Last-Modified` only | Revalidated more than needed; should be cached for a year (`immutable`) |
| `/assets/...` images | `Last-Modified` only | OK; moderate caching appropriate |
| GraphQL **POST** | `Cache-Control: max-age=86400`, `Expires` +1 day (added by the host) | Harmless today: browsers and nginx don't cache POST |
| GraphQL **GET** | Same **1-day max-age** | Any GET-based version check would be stuck for a day — avoid GET or override headers |
| REST | `no-cache, no-store, must-revalidate` | Never cached |
| nginx page cache | `x-server-cache: false` | No server-side page cache in front of the site |
| CDN | None detected | — |
| Browser storage | None used | — |

---

## 2. Proposed design

### 2.1 Content version: no WordPress plugin needed (recommended)

WordPress already exposes what's needed. A **content fingerprint** query returns one tiny line per public item:

```graphql
query ContentVersion {
  contentNodes(first: 100, where: { orderby: { field: MODIFIED, order: DESC } }) {
    pageInfo { hasNextPage }
    nodes { id modified }
  }
}
```

Angular hashes the result into a version string. It changes when any public page, carousel slide or event is **edited, published, unpublished, trashed or deleted** (IDs appear/disappear or `modified` changes), including ACF field and featured-image changes (they save the post). Autosaves and revisions don't change public `modified`, and background tasks don't either. Today it is ~11 items (< 1 KB) vs. ~6 KB+ for the full content.

Limits: a media file replaced in place without re-saving its page won't be detected (covered by the fallback expiry); `hasNextPage` true (> 100 items) triggers a full refresh and a log warning.

**Alternative** (only if wanted later): a ~40-line mu-plugin exposing `contentVersion` (an option bumped on `save_post`, `transition_post_status`, `deleted_post`, `acf/save_post`, `wp_update_nav_menu`). More exact for media/settings, but it's new backend code to deploy and maintain.

### 2.2 Angular changes

1. **`ContentCacheService`** (new, `Services/content-cache.service.ts`): the one place WordPress content is read through.
   - In-memory map: key = query + variables → `{ data, version, fetchedAt }` held in a `BehaviorSubject`, so components update automatically when content changes (existing `toSignal` code keeps working).
   - **Deduplication**: one in-flight request per key; simultaneous callers share it.
   - **No stale overwrite**: each fetch carries a sequence number; an older response never replaces a newer one.
   - **Persistent cache** in `localStorage` for public content only (pages, menu, carousel), namespaced and versioned; private/authenticated data is never stored (none exists today; the API is anonymous).
   - **Stale-if-error**: on a network error keep showing the last good content, retry with backoff, never lock in stale data past the fallback expiry.
2. **`ContentVersionService`** (new): runs the fingerprint query
   - once at app start (so the build-time homepage snapshot is checked immediately),
   - every **120 s** (configurable `environment.contentCheckSeconds`) while the tab is visible, plus when the tab regains focus,
   - **across tabs**: one tab checks and shares the result with `BroadcastChannel` (falls back to each tab checking).
   - Unchanged → nothing refetched. Changed → global invalidation (simple and correct for ~10 items), active queries refetch, inactive ones refetch when next used.
   - **Fallback expiry**: 24 h; `refresh()` available for a manual refresh.
3. **`WordpressService`**: `getMenuPages`, `getPageBySlug`, `getHomepageCarousels` go through the cache (signatures unchanged). REST-only legacy methods unchanged.
4. **Prerender/transfer cache**: keep prerendering for fast first paint and SEO. The transfer-cache content seeds the cache; the startup version check replaces it if WordPress changed since the build.
5. **Loading/error states**: page details show a loading placeholder and a "couldn't load — retry" message instead of an empty area.
6. **SEO**: unchanged (title/description still set from the page).

### 2.3 Hosting (`public_html/.htaccess`)

- `index.html`, `index.csr.html`: `Cache-Control: no-cache` (always revalidate via Last-Modified) → visitors pick up new deployments right away.
- Hashed `*.js`/`*.css`: `Cache-Control: public, max-age=31536000, immutable`.
- `/assets`, `/media`: `max-age=604800` (7 days).
- GraphQL keeps using POST, so the host's 1-day header on the WordPress side doesn't affect freshness; no WordPress/HostGator cache settings change.

### 2.4 When a WordPress update becomes visible

| Visitor | Sees the update |
|---|---|
| Opens the site after the change | Within about a second of loading (startup version check, then refetch) |
| Already has the site open | Within the check interval (default 2 minutes) or when returning to the tab |
| WordPress down | Keeps last good content; updates once WordPress is back |
| Angular code/styling change | Still needs a build and upload (as today) |

### 2.5 Testing plan

Unit tests (Karma) with fake timers and `HttpTestingController` for: dedupe, no stale overwrite, version unchanged → no refetch, version changed → refetch, error → last good data, fallback expiry, persistence, tab broadcast. Then **real network tests against staging** (`localhost:4200`): edit a staging page/carousel item, publish/unpublish/trash one, and confirm in the Network panel that only the fingerprint request repeats until the change, then the content updates. No production deploy without your approval.

### 2.6 Files expected to change

New: `Services/content-cache.service.ts`, `Services/content-version.service.ts`, their specs, `htaccess` template in `docs/`.
Changed: `wordpress.service.ts`, `wp-queries.ts` (fingerprint query), `environment*.ts` (`contentCheckSeconds`), `app.config.ts` (start version checks), `pagedetails.component.*` (loading/error state), `docs/change-log.md`.
Not changed: UI/styling, routes, WordPress, hosting configuration beyond `.htaccess`.

### 2.7 Rollback

Frontend: re-upload the previous build zip (keep `site-backup-*.zip`) and the previous `.htaccess`. Visitors' `localStorage` entries are namespaced and ignored by the old app. No WordPress changes to undo.
