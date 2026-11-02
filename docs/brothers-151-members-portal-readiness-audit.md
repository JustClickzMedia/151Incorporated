# BROTHERS OF 1-5-1 — WORDPRESS MEMBERS PORTAL READINESS AUDIT

**Audit date:** 2026-11-02 (05:50–05:56 UTC)
**Method:** Read-only inspection of the WordPress admin (logged-in administrator browser session), plus anonymous (`credentials: 'omit'`) GET/POST probes of public REST and GraphQL endpoints, and one cross-origin fetch from the public frontend origin. No settings were saved, no plugins changed, no accounts touched, no emails sent, no credentials entered.
**Redactions:** cPanel account username, admin email, JWT signing key, and all user records are intentionally omitted.
**Revision 2026-11-02 (correction):** The first version of this report said the live Angular build loads content through REST. **That was wrong.** The browser had a stale cached bundle (`main-CRFT644Q.js`). A re-check with the cache bypassed shows the live build is `main-2LH7QNHO.js` with `useGraphql: true`. A page load of `/pg/president` requested only `https://tzin.brothersof1-5-1.org/graphql`, with no `/wp-json/` calls. REST remains only in three legacy paths (see §10). The affected sections have been corrected.

**Revision 2026-11-02 (owner decision):** Access model decided by the owner. **Members log in to the member-only area of the public site and have no access to the WordPress backend (`/wp-admin`).** Only a small number of designated people get "super access": the WordPress backend **and** the member-only area. See §0. The affected sections (§6, §10, §11, §12, §13, §15 and the handoff) were updated.
**Revision 2026-11-02 (follow-up checks):** Several open items were answered from the repository and live GraphQL; see §0.2.

**Overall audit confidence:** 0.8. WordPress and WPGraphQL findings are high-confidence (0.9+). Hosting (cPanel) items are low-confidence because cPanel and the HostGator portal required a login, which was not attempted.

---

## 0. Owner Requirements and Follow-up Answers

### 0.1 Access model (owner decision, 2026-11-02)

| Who | Member-only area of the public site (`brothersof1-5-1.org`) | WordPress backend (`tzin.brothersof1-5-1.org/wp-admin`) | Notes |
|---|---|---|---|
| **Member** (role `b151_member`) | **Yes**, while their status is `active` | **No.** Any `/wp-admin` page redirects to the public site; no admin bar; no profile screen | Signs in on the public site only. Password set/reset happens through the portal's own pages (or core reset links that land back on the public site). |
| **Portal administrator** (role `b151_portal_admin`, a few named people) | **Yes** (always treated as an active member) | **Yes**, limited to what the portal needs: approve/suspend members, edit member profiles, manage member-only events, announcements and documents, edit site content | "Super access". Must use two-step login (2FA). |
| **Site administrator** (WordPress `administrator`, owner only) | **Yes** (always treated as an active member) | **Yes**, full (plugins, settings, users, roles) | Must use 2FA. Keep this to one or two accounts. |
| Visitor (not logged in) | No | No | Public pages only. |

Rules that follow from this:

1. **Backend access is decided by capability, not by status.** Only accounts with the `b151_backend_access` capability (portal administrators and site administrators) may load `/wp-admin`. Everyone else is redirected to `https://brothersof1-5-1.org/` (except `admin-ajax.php` / `admin-post.php`, which some flows need).
2. **Members never get backend capabilities**: no `edit_posts`, `upload_files`, `list_users`, etc. Their role has `read` plus portal capabilities only (`b151_view_member_content`, `b151_view_directory`, `b151_edit_own_profile`).
3. **The admin bar is hidden** for anyone without `b151_backend_access`, and `wp-login.php` sends members back to the public site after login, logout and password reset.
4. **"Super access" accounts are named individuals**, granted only by the site administrator, never by self-registration or by another portal administrator promoting themselves. Granting or removing it is recorded in the audit log.
5. **2FA is required** for every account with `b151_backend_access`. Optional (later) for members.
6. **Portal administrators can see both sides**: they can browse the member-only area exactly as members see it (to check content) and manage everything in the backend.
7. **Removing access is immediate**: suspending a member, or removing a portal administrator's role, destroys their sessions (`WP_Session_Tokens::destroy_all()`).

### 0.2 Answers found after the audit (verified 2026-11-02)

| Open item | Answer | How verified |
|---|---|---|
| Angular version (§14 item 12) | **22.2** (`@angular/core ^22.2.3`) | `package.json` |
| API Hardening MU-plugin CORS allowlist (§14 item 4, open question 2) | `https://brothersof1-5-1.org`, `https://www.brothersof1-5-1.org`, `http://localhost:4200`. It sends `Access-Control-Allow-Origin` (exact origin), `Allow-Methods: GET, POST, OPTIONS`, `Allow-Headers: Authorization, Content-Type, X-WP-Nonce`, `Vary: Origin`. It does **not** send `Access-Control-Allow-Credentials` (that's why the credentialed probe failed). | Plugin source in the repo (`wordpress/mu-plugins/bo151-api-hardening.php`) |
| Source of `Cache-Control: max-age=86400` on `/graphql` | **Not** the MU-plugin (it sets no cache headers). So it comes from the host (HostGator/LiteSpeed/Apache `mod_expires` or similar). | Plugin source |
| ACF "Event Group" | GraphQL field `eventGroup` on `Event` with at least `startTime`, `endTime`, `eventImage` (2 more fields not identified; introspection is off). On "GOT SKILLZ 6" `startTime`/`endTime` are empty. The Angular Events feature should read these instead of the proposed `eventDetails` group. | Anonymous GraphQL queries |

---

## 1. Executive Summary

| | |
|---|---|
| **Readiness verdict** | **Partially ready.** The base is solid: current WordPress and PHP, WPGraphQL 2.x, ACF PRO, a custom hardening MU-plugin already hiding user records from anonymous requests, introspection off, depth limits on, and public registration off. **Nothing membership-specific exists yet.** Status workflow, approval, directory, protected documents and member-only content all need to be built. |
| **Architecture** | Frontend `https://brothersof1-5-1.org` (Angular, nginx) and backend `https://tzin.brothersof1-5-1.org` (WordPress, Apache/LiteSpeed PHP) are on **different origins but the same site** (same registrable domain `brothersof1-5-1.org`). Both use HTTPS. |
| **Recommended auth** | **WordPress-issued, httpOnly, Secure cookie session**, using a small custom login endpoint, credentialed CORS restricted to the frontend origin, and nonce/CSRF protection. Don't make JWT the main session mechanism. Simple-JWT-Login is already active and should be locked down or retired once cookie auth works. |
| **Top risks before launch** | (1) Simple-JWT-Login's password→token endpoint is enabled with no WordPress-level rate limiting or MFA. (2) `xmlrpc.php` is live: another brute-force path. (3) Every Media Library upload is publicly reachable, so private docs can't go there. (4) No SMTP is configured, so reset and approval emails may not arrive. (5) GraphQL responses send `Cache-Control: max-age=86400`, which must never apply to authenticated responses. (6) The `new-prospects` post type is exposed via REST. (7) MySQL 5.7 is end-of-life. |

---

## 2. Verified WordPress Environment

| Finding | Evidence | Risk | Recommendation | Status |
|---|---|---|---|---|
| WordPress **7.1.4**, single site, `environment_type: production`, HTTPS on | Site Health → Info (wp-core). Site Health says it's up to date. | Low | None | Verified |
| PHP **8.3.36** 64-bit, SAPI `litespeed`, web server reported as Apache | Site Health → wp-server | Low | None | Verified |
| `memory_limit` 512M; `WP_MEMORY_LIMIT` 40M; `WP_MAX_MEMORY_LIMIT` 512M; `max_input_vars` 1000; `time_limit` 60s; upload/post max 64M | Site Health | Low | Raise `WP_MEMORY_LIMIT` to 256M when adding portal code (needs approval) | Verified |
| Database: MySQL **5.7.44-48** (mysqli), utf8mb4 | Site Health. Site Health also flags "Outdated SQL server". | Medium | Ask HostGator about MySQL 8 / MariaDB 10.6+. 5.7 is EOL. | Verified |
| OPcache is **full** (memory and interned strings at 100%) | Site Health: `opcode_cache_full: true` | Low (perf) | Host-level. Mention to HostGator if performance degrades. | Verified |
| `WP_DEBUG` false, `WP_DEBUG_LOG` false, `WP_DEBUG_DISPLAY` true (no effect while debug is off), `WP_CACHE` false | Site Health → wp-constants | Low | Set `WP_DEBUG_DISPLAY` false explicitly | Verified |
| `DISALLOW_FILE_EDIT`, `FORCE_SSL_ADMIN`, `COOKIE_DOMAIN` | Not exposed by Site Health | Unknown | Check `wp-config.php` | Unverified |
| Install path `/home1/<cpanel-user>/tzin.brothersof1-5-1.org` (the subdomain docroot sits directly under the account home) | Site Health → wp-paths | Info | Folders outside the web root (e.g. `/home1/<cpanel-user>/portal-private/`) are probably possible | Verified (path); write access Unverified |
| Filesystem: wordpress, wp-content, uploads, plugins, themes, **mu-plugins all writable** by PHP | Site Health → wp-filesystem | Medium | Fine for deploying a plugin. Note that a compromised plugin could write anywhere. | Verified |
| Active theme: HostGator child theme (`hostgator-us-tzin-brothersof1-5-1-org` 1.0.0) of **YITH Wonder 2.1.1**. Front end is disabled by Headless Mode. 5 inactive themes. | Site Health | Low | Remove inactive themes (Site Health flags this) | Verified |
| Permalinks `/%postname%/`; comments open by default | Site Health | Low | Turn off comments if unused (headless) | Verified |
| User count: **1** (Administrator) | Users screen, Site Health | Info | — | Verified |
| A Newfold staging copy exists. The ACF license is bound to `…/staging/1848`. | Site Health → ACF; HostGator plugin "Staging" panel; `newfold-staging/v1` REST namespace | Medium | Confirm the staging copy isn't publicly indexable and has no real member data | Unverified (exposure) |

### Custom post types (ACF-registered)

| CPT slug | REST | GraphQL | ACF field group | Public items (anon) | Note |
|---|---|---|---|---|---|
| `brothers` | Yes (`/wp/v2/brothers`) | No | none | 0 | Name suggests it was meant for a directory. Currently unused. |
| `events` | Yes | Yes (`Event`) | Event Group (5 fields, GraphQL on) | 1 | Public events in use |
| `homepage-carousel` | Yes | Yes (`HomepageCarousel`) | Carousel Small to Large (6 fields). "carousel gallary" is inactive. | — | Public content |
| `new-prospects` | **Yes** (`/wp/v2/new-prospects`) | No | prospect-attribtues (9 fields; GraphQL type defined, no GraphQL location) | 0 | **Likely holds prospect personal data and shouldn't be REST-exposed at all** |

ACF summary: 4 UI field groups (all GraphQL-mapped), 4 UI post types, 0 taxonomies, 0 options pages, `rest_field_groups: 0` (so ACF values are **not** included in REST responses).

## 3. Installed Plugins and Versions

All 17 plugins have auto-updates enabled through **HostGator → Settings**.

**Active (9)**

| Plugin | Version | Role | Note |
|---|---|---|---|
| Advanced Custom Fields PRO | 6.8.10 | Fields / CPTs | Licensed (Freelancer), active |
| WPGraphQL | 2.26.0 | API | Required by the two below |
| WPGraphQL for ACF | 3.1.0 | API | |
| WPGraphQL IDE | 5.8.0 | Dev tool | Admin-only (public IDE off) |
| Simple-JWT-Login | **3.6.8** | Auth (JWT) | **v4 available.** Admin notice recommends upgrading. |
| Headless Mode | 0.4.0 | Redirects WP front end | Old version line. Check compatibility with WP 7.x. |
| Classic Editor | 1.7.0 | Editing | |
| Resize Image After Upload | 1.8.6 | Media | |
| The HostGator Plugin | 3.3.0 | Host integration | Brings many `newfold-*` REST namespaces |

**Inactive (8):** Akismet 5.7.2, Creative Mail 1.6.9, MonsterInsights 11.3.0, Hello Dolly 1.7.2, Jetpack 16.3.1, OptinMonster 2.17.1, WPForms Lite 2.0.3.1, Yoast SEO 28.8. **Recommendation:** delete the ones you don't need (Site Health flags this), with approval.

**Must-Use (3):**

- **1-5-1 API Hardening 1.0.0** (custom). Its description says it "Hides user records from anonymous REST/GraphQL requests and restricts CORS to approved origins." Behaviour confirmed by probes (see §4 and §8). The allowlist contents weren't readable from the browser.
- **Endurance Page Cache 2.3.0.** The listing shows an "Enable" link, so it appears **disabled**. Site Health also reports "Page caching is disabled".
- **SSO 0.6** (Newfold/HostGator single sign-on from the host panel).

**By category:**

- **Security plugins:** none active. Jetpack and Akismet are inactive. No firewall, login limiter or 2FA plugin. **Verified.**
- **Caching:** no active page cache. Endurance is disabled. No persistent object cache (Site Health). **Verified.**
- **Authentication:** Simple-JWT-Login (active), Newfold SSO (MU). **Verified.**
- **Membership:** none. **Verified.**
- **Email/SMTP:** none active. Creative Mail is inactive and is a marketing tool, not SMTP. **Verified.**
- **Backup:** no backup plugin. Host-level backups are **Unverified**.

## 4. WPGraphQL Configuration

| Setting / test | Value / result | Evidence | Risk | Status |
|---|---|---|---|---|
| Version | 2.26.0 (+ ACF 3.1.0, IDE 5.8.0) | Plugins screen | Low | Verified |
| Endpoint | `https://tzin.brothersof1-5-1.org/graphql` | Settings `graphql_endpoint = graphql`; POST returned `RootQuery` | — | Verified |
| Public queries | Work over POST and GET (`/graphql?query=…` → 200) | Anonymous probes | Low | Verified |
| Restrict endpoint to logged-in users | **Off** (needed for public site content) | Settings | Low | Verified |
| Public introspection | **Off**. Anonymous `__schema` is rejected with a "not allowed for public requests" error. | Settings + probe | Low | Verified |
| Query depth limit | **On, max 15** | Settings | Low | Verified |
| Query complexity / analyzer | **Off** (`query_analyzer_enabled` off) | Settings | Medium | Verified |
| Batch queries | **On, limit 10** | Settings | Low–Med (multiplies cost per request) | Verified |
| GraphiQL IDE | Enabled for logged-in admins. Public IDE endpoint off. Admin-bar link off. | Settings → IDE tab | Low | Verified |
| Debug mode / tracing / query logs | All off | Settings; responses show `DEBUG_LOGS_INACTIVE` | Low | Verified |
| Anonymous `users { nodes }` | Returns `[]` | Probe | Low (good) | Verified |
| Anonymous `viewer` | `null` | Probe | — | Verified |
| `generalSettings.email` anonymously | `null` | Probe | Low (good) | Verified |
| Auth extensions | Simple-JWT-Login has **WPGraphQL integration enabled** (`wp_graphql[enabled]=1`). No WPGraphQL-JWT-Authentication or headless-login plugin. | Simple JWT settings | Medium | Verified |
| Custom schema fields | ACF-driven types `Event`, `HomepageCarousel`, `EventGroup`, `CarouselSmallToLarge`, `ProspectAttribtues` (type only) | ACF field group list | Low | Verified |
| Custom mutations | Unknown. Introspection is blocked anonymously, and the schema wasn't browsed in the IDE. | — | — | **Unverified** |
| CORS | A non-credentialed cross-origin POST from `https://brothersof1-5-1.org` **succeeded**. A **credentialed** POST (`credentials:'include'`) **failed** (no `Access-Control-Allow-Credentials`). The MU-plugin reportedly restricts to approved origins. | Fetch from the frontend origin | Info | Verified (behaviour); allowlist Unverified |
| Caching | GraphQL responses (anonymous POST and GET) carry **`Cache-Control: max-age=86400`**. The source (MU-plugin, `.htaccess`, or host) is unknown. No page cache active. | Response headers | **High for the portal**: authenticated responses must be `private, no-store` | Verified (header); source Unverified |

## 5. Existing Authentication Capabilities

**Simple-JWT-Login 3.6.8 configuration** (secrets not shown):

| Feature | State |
|---|---|
| **Authentication (password → JWT) `/wp-json/simple-jwt-login/v1/auth`** | **Enabled**, no auth code required |
| Token source accepted | `Authorization` header only (URL, session and cookie sources off) |
| Algorithm / key | HS256, 64-character key, not a default-looking value |
| Token TTL / refresh TTL | 60 min / 20,160 min (14 days) |
| JWT payload | `email`, `exp`, `id` (**email is readable by anyone holding the token**) |
| Auto-login, register, delete user, reset password | All **off** (register/delete still require an auth code if turned on) |
| Validate / refresh / revoke routes | Present (`/auth/validate`, `/auth/refresh`, `/auth/revoke`) |
| Plugin CORS module | Off (if turned on, its stored values are `*` origin and `*` headers, which shouldn't be used) |
| Protect-endpoints feature | Off |
| Login IP restriction | Not set |
| Google OAuth | Off |

**WordPress core and other auth:**

- Native cookie authentication on the WordPress origin works (admin session).
- Newfold SSO MU-plugin provides login from the host panel.
- Application Passwords (core) are presumably available over HTTPS. **Unverified.**
- **MFA:** none. **Verified** (no 2FA plugin).
- **Login rate limiting:** none at the WordPress layer. Server-level protection from HostGator/LiteSpeed is **Unverified**.
- `xmlrpc.php` answers (405 "accepts POST requests only"), so it's **enabled**. **Verified.**
- **Session revocation:** core WordPress `WP_Session_Tokens` (Users → Profile → "Log Out Everywhere Else"; `destroy_all()` in code) is available. JWT revoke exists, but access tokens stay valid until `exp`. **Verified** (capability exists).

## 6. Existing User Roles

| Topic | Value | Status |
|---|---|---|
| Roles | Default only: Subscriber, Contributor, Author, Editor, Administrator. No custom roles. | Verified |
| Backend access for low-privilege users | Core WordPress lets **every** logged-in user (even Subscriber) open `/wp-admin` (dashboard and profile) and shows the admin bar. Nothing blocks this today. Required change: see §0.1 (members must not reach the backend). | Verified (core behaviour) |
| Users | 1 (Administrator) | Verified |
| Public registration ("Anyone can register") | **Off** | Verified |
| Default role | Subscriber | Verified |
| Password reset | Core `wp-login.php?action=lostpassword` exists. Delivery depends on email (§9). Simple-JWT reset is off. | Verified (feature); delivery Unverified |
| Email verification | None beyond core reset links | Verified |
| Approval workflow | None | Verified |
| Login rate limiting | None at the WordPress layer | Verified (WP); host Unverified |
| MFA | None | Verified |
| Session revocation | Core sessions: yes. JWT: partial. | Verified |

## 7. Hosting Constraints

The HostGator portal and cPanel need a login. **No credentials were entered**, so most of this section is unverified.

| Item | Finding | Status |
|---|---|---|
| PHP version/config | 8.3.36, LiteSpeed SAPI, 512M, 60s, 64M uploads (from WordPress) | Verified (via WP) |
| WordPress location | Subdomain docroot `~/tzin.brothersof1-5-1.org` | Verified |
| Frontend hosting | `brothersof1-5-1.org` is served by `nginx/1.29.8` with an `x-server-cache` header (a pattern typical of HostGator/Newfold). Whether it's the same cPanel account is unknown. | Unverified |
| SSL | Both origins serve valid HTTPS. No HSTS header on the frontend. Certificate source unknown. | Partially verified |
| Cron | WordPress scheduled events are running (Site Health). cPanel cron availability is unknown. | Partially verified |
| Backups | No WordPress backup plugin. Host backups unknown. Staging exists. | Unverified |
| Database access | phpMyAdmin/remote MySQL unknown | Unverified |
| Custom plugin deployment | `plugins` and `mu-plugins` are writable. A custom MU-plugin is already deployed, so this is **possible**. | Verified |
| Private storage outside the web root | Path layout suggests `~/portal-private/` would sit outside the docroot | Unverified |
| Caching/security controls | HostGator plugin exposes Performance and Coming Soon settings. Cloudflare integration is disabled. WAF/ModSecurity unknown. | Partially verified |
| Reverse proxy (`/api` on the frontend → WordPress) | Depends on nginx/Apache proxy access, which is usually not available on shared hosting | Unverified |

## 8. Private Content Security Findings

| Finding | Evidence | Risk | Recommendation | Status |
|---|---|---|---|---|
| Anonymous REST user enumeration is blocked: `/wp/v2/users` and `/wp/v2/users/1` → 404 `rest_no_route` | Probe | Low (good) | Keep. Make sure the MU-plugin still allows authenticated portal use. | Verified |
| `/?author=1` redirects to `wp-login.php` (Headless Mode). Whether the intermediate redirect reveals the author slug wasn't confirmed. | Probe (redirect chain partly hidden) | Low | Block `?author=` explicitly in the MU-plugin | Partially verified |
| **Media Library is fully public**: `/wp/v2/media` lists 60 items with direct `/wp-content/uploads/YYYY/MM/…` URLs. Files are reachable without auth. Directory listing is blocked (403). | Probe | **High for private docs** | Never store member documents in the Media Library. Use a private folder outside the web root plus an authenticated PHP streaming endpoint. | Verified |
| **`new-prospects` CPT is exposed in REST** (`/wp/v2/new-prospects` → 200, 0 published). ACF values aren't in REST (`rest_field_groups: 0`). | Probe + ACF info | **Medium–High** if prospect PII is ever published | Set `show_in_rest=false` and `publicly_queryable=false`, or gate it by capability | Verified |
| `brothers` CPT is REST-exposed (0 items) | Probe | Medium if it becomes the directory | Don't use a public CPT for the directory. Build members on WP users plus protected resolvers. | Verified |
| Drafts are not readable anonymously (`?status=draft` → 400). Settings → 401. | Probe | Low (good) | — | Verified |
| GraphQL `users` is empty for anonymous requests, and `generalSettings.email` is null | Probe | Low (good) | Add explicit resolver-level checks for any new member fields | Verified |
| User metadata exposure through ACF/GraphQL | There are no user-location field groups today | Low now | Any future user fields must use `show_in_graphql` with auth callbacks | Verified (current) |
| **GraphQL caching:** `Cache-Control: max-age=86400` on responses | Headers | **High once authenticated** | Send `Cache-Control: private, no-store` and `Vary: Cookie, Authorization` for any request with an authenticated user. Find and fix the header source. | Verified (header) |
| `readme.html` publicly accessible | Probe → 200 | Low (version disclosure) | Block or delete | Verified |
| `xmlrpc.php` enabled | Probe → 405 | Medium (brute force) | Disable it in the MU-plugin or `.htaccess` | Verified |
| `debug.log` not reachable (redirects to login) | Probe | Low | — | Verified |
| No CSP/HSTS headers on the frontend | Response headers | Medium | Add HSTS and a CSP before handling sessions | Verified |
| 20+ `newfold-*` REST namespaces present | `/wp-json/` index | Low–Med (attack surface) | Review. Most require authentication. | Verified (presence) |

## 9. Email Configuration

| Finding | Evidence | Risk | Recommendation | Status |
|---|---|---|---|---|
| No SMTP or transactional-email plugin. WordPress falls back to PHP `mail()` through the host. | Plugin list | **High** (resets and approvals may land in spam or fail) | Install a free SMTP plugin (FluentSMTP is free, or WP Mail SMTP Lite) with authenticated sending | Verified |
| SPF/DKIM/DMARC for `brothersof1-5-1.org` | Not inspected | — | Verify DNS before going live | Unverified |
| Deliverability | No test email sent (needs approval) | — | Send one test after SMTP is set up | Unverified |

Recommended free options:

1. **A HostGator mailbox on the domain** (e.g. `portal@brothersof1-5-1.org`) via SMTP. It costs nothing extra if the plan includes email.
2. **Brevo free tier** (about 300 emails/day).
3. **Amazon SES** (very low cost).

Marketing tools like AWeber or Creative Mail are not suited to transactional mail such as password resets.

Emails needed: invitation, password set/reset, registration received, approved, status changed (inactive/suspended/reinstated), and admin "new pending member".

## 10. Recommended Authentication Architecture

**Verified facts it depends on:** the frontend origin is `https://brothersof1-5-1.org` and the backend is `https://tzin.brothersof1-5-1.org`. These are **same-site, cross-origin**, both HTTPS. Credentialed CORS currently fails. The production Angular build (`main-2LH7QNHO.js`, `useGraphql: true`) loads normal content through **GraphQL**. A `/pg/president` page load made only `/graphql` requests. The bundle still contains the REST base URL for three legacy paths:

- `pg/:id/:title`: old links that look up the page name once and redirect.
- `search/:term`: there's no search box any more, so visitors only arrive from old links.
- `pst/:id/:title`: old post links. New `/blog/...` pages use GraphQL.

There are no portal routes yet. Moving or removing these three paths would let anonymous REST be locked down later (see §12).

| Option | How it works | Pros | Risks | Hosting needs |
|---|---|---|---|---|
| **A. WordPress cookie session (recommended)** | Custom endpoint `POST /wp-json/b151/v1/session` calls `wp_signon()`, sets httpOnly, Secure, SameSite=Lax (or Strict) cookies on `tzin…`. Angular uses `withCredentials: true`. A nonce or CSRF token is required on state-changing requests and GraphQL. | No tokens readable by JavaScript (XSS can't steal the session). Reuses WordPress sessions, revocation, roles and password reset. No new crypto. Same-site, so Lax cookies are sent and Safari ITP doesn't apply. | CSRF must be handled (nonce plus Origin check). CORS must echo the exact origin with `Allow-Credentials: true` and never `*`. Caching must vary or bypass on cookie. | MU-plugin/plugin deploy only (available) |
| B. Same-origin reverse proxy (`brothersof1-5-1.org/api` → WordPress) + cookies | nginx/Apache proxies the API under the frontend origin | No CORS at all. Simplest browser model. | Rarely allowed on shared hosting. Cookie path/domain rewriting is needed. | Proxy capability (**Unverified, probably not available**) |
| C. JWT bearer (Simple-JWT-Login, already installed) | Password → JWT. Angular sends `Authorization: Bearer`. | No CSRF problem. Already works with GraphQL. | Token is readable by JavaScript and exposed to XSS. A 14-day refresh token is a long-lived credential. Revocation only applies after `exp`. Email is in the payload. The plugin is a large attack surface (needs the v4 upgrade). | Already present |

**Recommendation: Option A.** It fits the access model in §0.1: the same WordPress session powers the member-only area, while a capability check (`b151_backend_access`) decides who may also open `/wp-admin`. Members get a WordPress session but are redirected away from the backend. Before relying on it, confirm one thing with a test: how WPGraphQL 2.x treats cookie-authenticated requests without an `X-WP-Nonce`. It may treat them as public, which is fine if the portal sends a nonce on each request. The login endpoint must rate-limit, return a fresh nonce, and reject non-`active` members. Once Option A works, **turn off Simple-JWT-Login authentication or remove the plugin** (requires approval).

## 11. Required Backend Development

These go in one custom plugin, `b151-members-portal`, separate from the existing hardening MU-plugin.

1. **Roles and capabilities (per §0.1):**
   - `b151_member`: `read`, `b151_view_member_content`, `b151_view_directory`, `b151_edit_own_profile`. **No backend access.**
   - `b151_portal_admin` ("super access", named people): everything a member has, plus `b151_backend_access`, `b151_manage_members`, `b151_manage_member_content` (member events, announcements, documents) and the editing capabilities needed for site content (Editor-level: `edit_posts`, `edit_pages`, `upload_files`, …). No plugin, theme, settings or role management.
   - WordPress `administrator`: gets all `b151_*` capabilities added, so the owner also sees the member area.
   - **Backend gate:** on `admin_init`, if the user lacks `b151_backend_access` and the request isn't `admin-ajax.php`/`admin-post.php`, redirect to `https://brothersof1-5-1.org/`. Hide the admin bar (`show_admin_bar` false) for the same users. Redirect `login_redirect`/`logout_redirect` for members to the public site.
   - **Who can grant super access:** only `administrator` (`promote_users`). Portal administrators can approve and suspend members but can't create other portal administrators. Every grant/removal goes to the audit log.
2. **Membership status:** user meta `b151_status` = `pending | active | inactive | suspended`, plus audit meta (`approved_by`, `approved_at`, `status_changed_at`, `status_reason`). Enforce it in the `authenticate` filter (only active members can log in), and on status change call `WP_Session_Tokens::get_instance($id)->destroy_all()`.
3. **Onboarding:** invite-only. An officer creates a pending invite, which generates a one-time, time-limited token by email that the member uses to set a password. Optionally, a public "request membership" form that creates pending users and is rate-limited.
4. **Admin UI (backend, portal administrators and site administrator only):** Users list columns and filters by status. Bulk approve, suspend, reactivate. Email notifications. Members never see this UI.
5. **Session API (REST):** `POST session` (login, rate-limited, generic errors), `DELETE session` (logout), `GET session/me` (current member and nonce). Strict CORS allowlist with credentials. `Cache-Control: no-store`.
6. **GraphQL extensions:** `viewerMember` profile (read and update own allowed fields only), `memberDirectory` (active members only, curated fields only, no email unless the member opts in), member-only events (`visibility` meta enforced in the resolver), announcements, documents list. Every resolver checks capability and active status.
7. **Private announcements:** a non-public CPT (`b151_announcement`, `public=false`, `show_in_rest=false`) exposed only through protected GraphQL fields.
8. **Member-only events:** add a `visibility` (public/members) field to `events`, and filter public queries to exclude members-only events.
9. **Protected documents:** files stored outside the web root, with metadata in a private CPT. Downloads go through `GET /wp-json/b151/v1/documents/{id}/download`, which streams the file after an auth check. Allowed MIME types, size limits, randomized storage names.
10. **Hardening additions:** login throttling (transient or option counters per IP and per username), disable `xmlrpc.php`, block `?author=`, block `readme.html`, `no-store` for authenticated GraphQL and REST, `Vary: Origin, Cookie`.
11. **Access revocation:** a status change to inactive or suspended destroys sessions immediately, and the resolver checks deny access on the very next request.
12. **Audit log:** a simple custom table or option log of logins, failed logins, and status changes.

## 12. Required WordPress Configuration

Every change below **needs owner approval**.

- Set up SMTP (FluentSMTP or WP Mail SMTP) with a domain sender, and configure SPF/DKIM/DMARC.
- Turn off Simple-JWT-Login authentication, or upgrade it to v4 and restrict it, once cookie auth replaces it. Never enable its CORS module with `*`.
- Turn on the WPGraphQL query analyzer (complexity limit). Consider lowering the depth limit to about 10 and the batch limit to about 5.
- Make sure the MU-plugin's CORS allowlist is exactly `https://brothersof1-5-1.org` (plus `https://www.` if used), with `Allow-Credentials: true` only for that list.
- Find and correct the source of `Cache-Control: max-age=86400` on `/graphql`.
- Set `new-prospects` and `brothers` CPTs to `show_in_rest=false` (or capability-gated).
- Add to `wp-config.php`: `DISALLOW_FILE_EDIT` true, `WP_DEBUG_DISPLAY` false, `WP_MEMORY_LIMIT` 256M, and possibly `FORCE_SSL_ADMIN`.
- Delete unused inactive plugins and themes. Add a backup solution (host or plugin) with off-site copies.
- Require 2FA for every account with backend access (site administrator and portal administrators). A free 2FA plugin, or TOTP built into the portal plugin.
- Block `/wp-admin` and the admin bar for everyone without `b151_backend_access` (see §0.1). Test with a member account that `/wp-admin/`, `/wp-admin/profile.php` and the admin bar are all unavailable, and that the member area still works.
- Add HSTS and CSP headers on the frontend server.

## 13. Security Risks and Priorities

| # | Risk | Level | Fix before launch? |
|---|---|---|---|
| 1 | JWT password endpoint plus `xmlrpc.php` with no login throttling or MFA | **High** | Yes |
| 2 | Media Library is public, so documents would leak | **High** | Yes (design constraint) |
| 3 | 24-hour cache header on GraphQL could cache member data | **High** | Yes |
| 4 | No SMTP, so resets and approvals are unreliable | High | Yes |
| 5 | `new-prospects` and `brothers` CPTs exposed in REST | Medium–High | Yes |
| 6 | No backups verified | Medium–High | Yes |
| 7 | No query complexity limit; batching on | Medium | Yes |
| 8 | MySQL 5.7 EOL | Medium | Plan it |
| 9 | No HSTS/CSP on frontend | Medium | Yes |
| 10 | Simple-JWT-Login 3.x (v4 available) and Headless Mode 0.4.0 age | Medium | Upgrade or retire |
| 11 | Staging copy exposure unknown | Medium | Verify |
| 12 | `readme.html` version disclosure; inactive plugins and themes | Low | Nice to have |
| 13 | Members could open `/wp-admin` and see the admin bar (WordPress default for every logged-in user) | **High** (owner requirement) | Yes: backend gate by capability (§0.1) |

## 14. Items Requiring Manual Verification

1. cPanel: PHP selector, cron, backups (frequency and retention), phpMyAdmin, ModSecurity/WAF, email accounts, SSL issuer and auto-renew.
2. Whether `brothersof1-5-1.org` (the Angular app) is on the same HostGator account, and whether reverse proxying is possible.
3. Whether a folder outside the docroot (e.g. `~/portal-private/`) can be created and is PHP-readable.
4. The contents of the `1-5-1 API Hardening` MU-plugin: CORS allowlist, headers, and whether it sets `max-age=86400`.
5. `wp-config.php`: `DISALLOW_FILE_EDIT`, `COOKIE_DOMAIN`, `FORCE_SSL_ADMIN`, salts present.
6. Custom GraphQL mutations (browse the schema in the admin GraphQL IDE).
7. The `prospect-attribtues` field list (9 fields) and whether any prospect drafts with PII exist in the admin.
8. Whether the Newfold staging site is publicly accessible or indexed.
9. DNS: SPF, DKIM, DMARC for the domain.
10. How WPGraphQL 2.26 treats cookie auth with and without `X-WP-Nonce` (test on staging).
11. Whether HostGator/LiteSpeed applies server-side login rate limiting.
12. The Angular version (the tool blocked reading the `ng-version` attribute; check `package.json`).

## 15. Recommended Implementation Sequence

1. **Backups and staging.** Confirm host backups. Use the existing staging site for all portal work.
2. **Quick hardening** (approval): disable xmlrpc, block author enumeration and readme, fix GraphQL cache headers, hide the `new-prospects` and `brothers` REST routes, turn on the query analyzer, add admin 2FA.
3. **Email:** SMTP plugin, domain sender, SPF/DKIM/DMARC, one approved test.
4. **Portal plugin v1:** roles and capabilities per §0.1 (member = front end only; portal administrator and site administrator = backend + member area), backend gate and hidden admin bar for members, status meta, auth gate, admin approval UI, notifications, audit log.
5. **Session API and CORS** with credentials. Verify cookie behaviour from the Angular origin on staging.
6. **Retire or limit Simple-JWT-Login** once cookie auth is proven.
7. **GraphQL member schema:** viewer profile, directory, member events, announcements.
8. **Protected documents:** private storage plus streaming endpoint.
9. **Angular:** move the three legacy REST paths (`pg/:id/:title`, `search/:term`, `pst/:id/:title`) to GraphQL, or remove them. Then add portal routes, guards, and an HTTP interceptor (`withCredentials`, nonce header).
10. **Lock down anonymous REST** (approval): once the frontend uses no REST, restrict `/wp-json/wp/v2/*` for anonymous users, except anything WordPress core or plugins need.
11. **Security review and soft launch** with officers, then invite members.

---

# CLAUDE CODE IMPLEMENTATION HANDOFF

*This section stands on its own. Everything below was observed on 2026-11-02 unless marked UNVERIFIED.*

### Confirmed architecture

- **Frontend:** Angular SPA at `https://brothersof1-5-1.org`, served by `nginx/1.29.8` (header `x-server-cache`). The live build `main-2LH7QNHO.js` has `useGraphql: true`, and normal content (pages, menu, carousel, blog) loads from `https://tzin.brothersof1-5-1.org/graphql`. A `/pg/president` load made **no** `/wp-json/` requests. REST is still referenced by three legacy routes: `pg/:id/:title` (lookup then redirect), `search/:term`, and `pst/:id/:title`. Routes in the main bundle: `''`, `search/:term`, `pg/:slug`, `pg/:id/:title`, `404`, `pst/:id/:title`, `**`. `/blog/...` is presumably lazy-loaded. No portal routes yet. Local repo: `/Users/kennethelliott/development/151Incorporated`.
- **Backend:** WordPress 7.1.4 at `https://tzin.brothersof1-5-1.org` (siteurl = home). PHP 8.3.36 (LiteSpeed SAPI), MySQL 5.7.44, HostGator shared hosting. Docroot `/home1/<cpanel-user>/tzin.brothersof1-5-1.org`. The WordPress front end is disabled by the Headless Mode plugin.
- **Origins:** same registrable domain, different hosts, so **same-site and cross-origin**. Both HTTPS.
- **GraphQL:** `https://tzin.brothersof1-5-1.org/graphql`. Public queries OK over POST and GET. Introspection off for the public. Depth 15. Batching on (10). Complexity analyzer off. Debug off.
- **CORS today:** a non-credentialed request from the frontend origin works. A credentialed request fails (no `Access-Control-Allow-Credentials`).
- **Caching today:** `/graphql` responses carry `Cache-Control: max-age=86400` (source UNVERIFIED). No page cache. No object cache.

### Confirmed plugin versions

**Active:** WPGraphQL 2.26.0, WPGraphQL for ACF 3.1.0, WPGraphQL IDE 5.8.0, ACF PRO 6.8.10, Simple-JWT-Login 3.6.8, Headless Mode 0.4.0, Classic Editor 1.7.0, Resize Image After Upload 1.8.6, The HostGator Plugin 3.3.0.

**MU-plugins:** `1-5-1 API Hardening` 1.0.0 (custom; hides users from anonymous REST/GraphQL and restricts CORS), Endurance Page Cache 2.3.0 (disabled), SSO 0.6.

**Inactive:** Akismet, Creative Mail, MonsterInsights, Hello Dolly, Jetpack, OptinMonster, WPForms Lite, Yoast.

### Existing functionality to reuse

- WordPress users, roles, `wp_signon`, `WP_Session_Tokens` for revocation, and the core password-reset flow.
- WPGraphQL plus WPGraphQL for ACF for schema extension (`register_graphql_field`, `register_graphql_mutation`).
- ACF PRO for member profile fields: use user-location field groups with `show_in_graphql` and auth-checked resolvers.
- The existing `1-5-1 API Hardening` MU-plugin. Extend it, or keep it and add CORS-with-credentials logic in the portal plugin. Avoid duplicate CORS header writers.
- The `events` CPT (GraphQL `Event`, ACF "Event Group"). Add a `visibility` field.
- Existing ACF CPTs: `brothers` (unused, REST-exposed), `new-prospects` (REST-exposed, 9-field ACF group, no GraphQL).

### Required backend modules (custom plugin `b151-members-portal`)

1. Roles and capabilities per §0.1: `b151_member` (member-only area, **no backend**), `b151_portal_admin` (named "super access" people: backend + member area), and all `b151_*` capabilities added to `administrator`. Backend gate: `admin_init` redirect to the public site for anyone without `b151_backend_access` (allow `admin-ajax.php`/`admin-post.php`), admin bar hidden, member login/logout redirects to the public site. Only `administrator` can grant `b151_portal_admin`. 2FA required for backend-capable accounts.
2. Status model: user meta `b151_status` ∈ {pending, active, inactive, suspended}, enforced in the `authenticate` filter and in every resolver. Status change destroys sessions.
3. Invite and approval flow with one-time tokens and email notifications.
4. Session REST API: `POST/DELETE /wp-json/b151/v1/session`, `GET /session/me` (returns a `wp_rest` nonce). Login throttling per IP and username. Generic errors.
5. Credentialed CORS: exact-origin allowlist (`https://brothersof1-5-1.org`, maybe `https://www.brothersof1-5-1.org`), `Access-Control-Allow-Credentials: true`, `Vary: Origin`. Handle preflight for `/graphql` and `/wp-json/b151/*`.
6. Cache control: `private, no-store` whenever `get_current_user_id() > 0`. Fix the `max-age=86400` source.
7. GraphQL: `viewerMember`, `updateViewerMember` (allowlisted fields), `memberDirectory` (active only, curated fields), member events, announcements CPT (`public=false`), documents list.
8. Protected documents: storage outside the docroot plus an authenticated streaming endpoint. Never the Media Library (it's fully public: 60 items listed anonymously).
9. Hardening: disable XML-RPC, block `?author=`, block `readme.html`, set `new-prospects`/`brothers` to `show_in_rest=false`.
10. Audit log and admin UI (status columns, filters, bulk actions).
11. Frontend clean-up (Angular repo): migrate the three legacy REST routes to GraphQL or remove them. After that, anonymous `/wp-json/wp/v2/*` can be restricted on the WordPress side (approval).

### Recommended authentication strategy

Access model (owner decision): **members use only the member-only area of the public site and can't open `/wp-admin`; a few named portal administrators (and the site administrator) can use both.** Enforced by capability `b151_backend_access`, not by membership status.

WordPress cookie session. httpOnly, Secure, SameSite=Lax cookies are issued by the WordPress origin and sent by Angular with `withCredentials: true` (same-site, so Lax cookies are included). Add a CSRF nonce header (`X-WP-Nonce`) and an Origin check. **Test first** how WPGraphQL 2.26 handles cookie auth with and without the nonce. JWT (Simple-JWT-Login) shouldn't be the main mechanism: tokens readable by JavaScript, a 14-day refresh, email in the payload. Once cookies work, turn off its `/auth` endpoint or remove the plugin.

### Hosting limitations

- Shared HostGator hosting. No confirmed reverse-proxy ability. cPanel was not inspected (login required).
- `WP_MEMORY_LIMIT` is 40M (raise it). OPcache is full. MySQL 5.7 is EOL.
- No SMTP. PHP `mail()` only.
- Backups UNVERIFIED. A Newfold staging environment exists.
- Plugin and MU-plugin folders are writable, so a custom plugin can be deployed (by upload, SFTP, or Git deploy if configured — UNVERIFIED).

### Configuration changes requiring approval

SMTP plugin and DNS records; Simple-JWT-Login disable, upgrade or remove; WPGraphQL query analyzer on and depth/batch limits lowered; CORS allowlist plus credentials; GraphQL cache-header fix; CPT REST exposure changes; `wp-config.php` constants; deleting inactive plugins and themes; 2FA plugin; disabling XML-RPC; frontend HSTS/CSP; any test email.

### Open questions

1. Is the Angular app on the same HostGator account? Can it proxy `/api`?
2. What does the API Hardening MU-plugin's CORS allowlist contain? Does it set the 24-hour cache header?
3. Which fields does `prospect-attribtues` hold, and is prospect data meant to be member-visible?
4. Which member fields go in the directory, and does each member opt in to showing email or phone?
5. Invite-only, or a public request-to-join form?
6. ~~Which roles approve members?~~ **Decided:** named portal administrators (`b151_portal_admin`) and the site administrator. Still open: who those people are.
7. Which email sender and domain should be used for transactional mail?
8. Are custom GraphQL mutations already present? (Check the schema in the admin IDE.)

### Risks that must be addressed before deployment

1. Brute-force paths: Simple-JWT `/auth` and `xmlrpc.php`, with no throttling or MFA.
2. Member data cached by `Cache-Control: max-age=86400`.
3. Public Media Library: documents must go to private storage.
4. Missing transactional email.
5. REST-exposed `new-prospects` and `brothers` CPTs.
6. Unverified backups.
7. No GraphQL complexity limit.
8. No HSTS/CSP on the frontend.
9. Credentialed CORS must be exact-origin, never `*`.
