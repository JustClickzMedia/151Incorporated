# Backend Audit — Brothers of 1-5-1 WordPress

- **Audit date:** 2026-10-26
- **Method:** Read-only. I looked at the WordPress admin through the owner's logged-in browser session, and tested the public REST and GraphQL endpoints with credentials omitted, which simulates an anonymous visitor.
- **Changes made:** None. I installed, toggled and saved nothing.
- **Not accessible during this audit:** the local repo (`/Users/kennethelliott/development/151Incorporated`), GitHub, cPanel and the HostGator file system. See the [Access checklist](#access-checklist).

---

## 1. Topology

| Component | Value |
|---|---|
| Public site (Angular SPA) | `https://brothersof1-5-1.org`, served by nginx. Routes are `''`, `search/:term`, `pg/:id/:title`, `pst/:id/:title` and `**` |
| WordPress backend | `https://tzin.brothersof1-5-1.org` (headless) |
| API base hard-coded in the Angular bundle | `https://tzin.brothersof1-5-1.org/wp-json/wp/v2/` |
| Media | Served directly from `tzin.brothersof1-5-1.org/wp-content/uploads/...`, plus some static images in the Angular `assets/` folder |
| Is the WP code in the Angular repo? | **Unknown.** I couldn't open the repo. The live evidence (the WP install is on HostGator and its theme is a HostGator-generated child theme) suggests WordPress is maintained separately on HostGator. |

## 2. Platform versions

| Item | Value |
|---|---|
| WordPress | 7.1.3 |
| PHP | 8.3.36 (LiteSpeed SAPI), memory limit 512M, max execution time 60s |
| Database | MySQL 5.7.44, utf8mb4 / utf8mb4_unicode_520_ci |
| Web server | Apache, behind an nginx front layer |
| HTTPS | Yes |
| Permalinks | `/%postname%/`. **Site Health also reports custom `.htaccess` rules** (see Blocker B1) |
| Environment type | production (`WP_ENVIRONMENT_TYPE` undefined) |
| `WP_DEBUG` | off. `WP_DEBUG_DISPLAY` is reported as **Enabled**, which only has an effect if debug is turned on |
| `WP_CACHE` | Disabled |
| OPcache | **Full** (127/127 MB, interned strings 100%). Performance risk |
| Open registration | No |
| Default comment status | Open (unused in headless mode) |

## 3. Theme

- **Active:** `hostgator-us-tzin-brothersof1-5-1-org` 1.0.0, a child of **YITH Wonder 2.1.1**.
- **Inactive:** Sinatra, Twenty Twenty-Two through Twenty Twenty-Five.
- The theme doesn't matter for the headless frontend, but it's a source of updates and attack surface.

## 4. Plugins

**Active (8):**

| Plugin | Version | Notes |
|---|---|---|
| Advanced Custom Fields PRO | 6.8.10 | Licensed (Freelancer). Defines all custom content |
| Classic Editor | 1.7.0 | |
| Headless Mode | 0.4.0 | Blocks the WP front end for visitors and lets REST and GraphQL through |
| Resize Image After Upload | 1.8.6 | |
| Simple-JWT-Login | 3.6.8 | v4 is available. Auto-updates off. **The CORS config is a security finding** (§8) |
| **WPGraphQL** | **2.25.0** | **Already installed and active on production.** Auto-updates off |
| WPGraphQL for ACF | 3.0.0 | |
| WPGraphQL IDE | 5.5.0 | 5.7.0 is available. Auto-updates off |

**Must-use (2):** Endurance Page Cache 2.3.0 and SSO 0.6 (HostGator/Newfold).

**Inactive (9):** Akismet, Creative Mail, MonsterInsights, Hello Dolly, Jetpack, OptinMonster, The HostGator Plugin, WPForms Lite, Yoast SEO. These are cleanup candidates, but only after a backup and only with approval.

## 5. Content model

| Post type (ACF UI) | REST base | GraphQL | Published count | ACF field group |
|---|---|---|---|---|
| Pages | `pages` | `pages` / `page` | 6 (IDs 10, 15, 17, 19, 27, 29) | none |
| Posts | `posts` | `posts` / `post` | **0** | none |
| Media | `media` | `mediaItems` | 58 | none |
| Events | `events` | `events` (single) / `allEvents` (connection) | 0 | Event Group: `startTime`, `endTime`, `paymentUrl`, `eventImage` |
| Homepage Carousel | `homepage-carousel` | `homepageCarousel` / `allHomepageCarousel` | 3 | Carousel Small to Large: six responsive images (desktop/tablet/mobile × landscape/portrait) |
| Brothers | `brothers` | **not exposed** | 0 | none |
| New Prospects | `new-prospects` | **not exposed** | 0 | prospect-attribtues (9 fields, sic). **Likely personal data** |

- **Taxonomies:** none custom. Only the core category and tag taxonomies exist.
- **Menus:** none (the REST menus list is empty).
- **ACF:** four field groups. **All four are enabled for GraphQL and none for REST**, so ACF data is currently reachable only through GraphQL. The "carousel gallary" group is inactive.
- **Naming:** the GraphQL plural names are awkward (`events` returns a single item, and the connection is `allEvents`). Fix them on staging before writing the contract. Renaming changes the schema, so coordinate the change with Angular.
- **Front page setting:** `show_on_front = posts`, `page_on_front = 0`.

## 6. REST endpoints consumed by Angular

I extracted these from the production bundle `main-CRFT644Q.js`:

| Call | Used for |
|---|---|
| `GET /wp-json/wp/v2/pages/13?_embed` | Home page content |
| `GET /wp-json/wp/v2/pages/{id}?_embed` | `pg/:id/:title` route |
| `GET /wp-json/wp/v2/pages?_embed&filter[orderby]=menu_order&order=…` | Page list / navigation. Note that `filter[]` has been unsupported in core since WP 4.7 |
| `GET /wp-json/wp/v2/posts?_embed&per_page=6` | Post list |
| `GET /wp-json/wp/v2/posts/{id}?_embed` | `pst/:id/:title` route |
| `GET /wp-json/wp/v2/posts?search={term}` | `search/:term` route |

The Angular code doesn't call the Events or Homepage Carousel types; the carousel on the live site appears to use static assets.

## 7. Live endpoint test results (anonymous)

| Request | Result |
|---|---|
| `/wp-json/…` (pretty URL, which Angular uses) | **404 from Apache (HTML error page).** The live homepage's request for `pages/13` failed (seen as a 503 in the browser, with a console `ERROR`) |
| `/index.php?rest_route=/…` (plain URL) | 200. The REST API itself works |
| `rest_route=/wp/v2/pages/13` | **404 `rest_post_invalid_id`. Page 13 doesn't exist** (not in trash either) |
| `/graphql` (pretty URL) | Not served as GraphQL (404 or non-JSON) |
| `/index.php?graphql` | **200. GraphQL works** |
| GraphQL introspection, anonymous | Blocked (correct) |
| GraphQL `users { nodes { slug } }`, anonymous | **Returns the admin account's slug** |
| REST `/wp/v2/users`, anonymous | **Returns 1 user** (same exposure) |
| `/wp-content/uploads/2018/09/favicon.ico` | 404. The favicon the frontend references is missing |

## 8. Security, authentication, caching and backups

**WPGraphQL settings (production):**

- Endpoint: `graphql`
- Logged-in-only: off
- Batch requests: **on** (max 10)
- **Query depth limit: off** (max 15 is configured but not enforced)
- Public introspection: off
- Debug: off
- Tracing and query logs: off
- GraphiQL IDE: enabled, not public
- **"Delete data on deactivation": ON.** Deactivating the plugin would erase its settings, so it must be turned off before any plugin work.

**Simple-JWT-Login 3.6.8:**

- Authentication endpoint: enabled
- HS256
- Token TTL 60 min, refresh window 14 days
- Auto-login, register and delete: off
- WPGraphQL integration: on
- **CORS: `Allow-Origin: *`, methods GET/POST/PUT/DELETE/OPTIONS/HEAD, `Allow-Headers: *`.** This is overly permissive and must be restricted to approved origins.
- IP allow-lists are empty.

**Other:**

- **Caching:** the Endurance Page Cache mu-plugin; `WP_CACHE` off; no object cache seen; OPcache full. No GraphQL response caching is configured (for example WPGraphQL Smart Cache).
- **Backups:** no backup plugin is active. **HostGator Basic Backup (weekly) is active.** The last backup was 2026-10-26 at 00:58 EDT (Ashburn) and the next is 2026-11-02. Restore options cover the whole site, files only, or the database only.
- **Hosting:** HostGator Business plan with 3 sites: `brothersof1-5-1.org` (Angular), `tzin.brothersof1-5-1.org` (WordPress) and **`tzinprivate.brothersof1-5-1.org`**. The last one is unreviewed and could be a staging candidate. The portal also offers a Staging tool. The document root is `~/tzin.brothersof1-5-1.org`.
- **Old `.htaccess` copies** in the document root (`.htaccess-old` and `.htaccess.phpupgrader.*`) are clean-up candidates.
- **The portal's SSL card shows "Basic — Not secure"**, even though the site serves HTTPS. This should be verified in the SSL Manager.
- **User roles:** only one user is visible publicly. A full role audit needs Users-screen access, and I didn't enumerate it to avoid collecting personal data.

---

## Blockers

| # | Blocker | Impact | Owner |
|---|---|---|---|
| ~~B1~~ | **Update 2026-10-26: not reproducible.** Earlier, `/wp-json/` returned an Apache 404 and a 503. On a later re-test it returned 200 on 15 of 15 requests, and the Angular `pg/29/membership` route rendered WordPress content. `.htaccess` was inspected read-only and contains the standard WordPress rewrite block plus Endurance Page Cache rules, so nothing needed changing. This was most likely a transient host or cache error | Intermittent outages are possible | Monitor. If it recurs, open a HostGator ticket |
| **B2** | Angular home requests page **ID 13, which doesn't exist** | The home content fails even after B1 is fixed | Angular workstream, or restore/recreate the page. Decision needed |
| B3 | No confirmed backup or restore path, and no staging site | Phase 3 can't start safely | Kenneth: cPanel access |
| B4 | Repo not accessible from this session (no linked computer, and the GitHub token is invalid) | The docs aren't committed yet, and I can't confirm whether WP code is in the repo | Kenneth |
| B5 | WPGraphQL "Delete data on deactivation" is ON | Risk of losing settings during plugin work | Approval to toggle it off |
| B6 | Wildcard CORS with write methods (Simple-JWT-Login) | Any website can make cross-origin API calls | Approval to restrict |

## Recommended safe sequence

1. **Approve and fix the production outage (B1)**, separately from the GraphQL work. Take a full cPanel backup first, then inspect `.htaccess` and re-save permalinks. The goal is to restore the REST API, which the safety rules say must be preserved.
2. **Decide how to handle page 13 (B2):** point Angular at an existing page ID or slug, or set a static front page. Communicate this through the docs only.
3. **Establish backups (Phase 2):** a cPanel full backup, a DB export, and a `wp-content` archive. Then test a restore into staging.
4. **Create staging** with HostGator/cPanel staging or a subdomain clone (for example `staging.brothersof1-5-1.org`), with `noindex` and HTTP auth.
5. **Harden on staging:** turn off "delete data on deactivation", turn on the depth limit, decide on batching, restrict CORS to `https://brothersof1-5-1.org`, block anonymous user enumeration in both REST and GraphQL, and fix the GraphQL plural names.
6. **Verify on staging:** read-only queries for pages, media, events and carousel, pagination, field privacy for New Prospects and Brothers, and an evaluation of caching (Smart Cache).
7. **Write `graphql-contract.md`** from the verified staging schema and hand it to Angular.
8. **Promote the settings to production one at a time, with approval.** Keep REST on until Angular's GraphQL migration is verified.

## Access checklist

- [ ] cPanel login (backups, staging, File Manager for `.htaccess`). Kenneth does this himself; credentials are never shared in chat
- [ ] Confirmation of any existing HostGator automated backups and their retention
- [ ] The repo linked to this session (link your computer, or provide a valid GitHub token or the repo URL)
- [ ] Decision on whether the WP theme and plugins should be version-controlled
- [ ] Approved CORS origins list (production plus any dev origin, such as `http://localhost:4200`)
- [ ] A WordPress Users/Roles review (admin only)
