# Members-Only Portal — Architecture Design (Checkpoint 1)

**Status:** design for approval. **No implementation code has been written.** Nothing has been changed in WordPress.
**Decided 2026-11-02 (owner):** member events are a separate private type; directory shows name, chapter, year and an **Active** indicator by default, everything else opt-in; "active" will later also depend on dues (§3.1, §3.3, §6, §12 Q8–Q9).
**Decided 2026-11-02 (owner):** classifications (Member, Life Member, Honorary), membership number format `151-NNNNN`, inactivity logout, 2FA for admins (§3.1, §4.3, §4.5, §12 Q3–Q6).
**Decided 2026-11-02 (owner):** roles — all admin tiers built, one admin for now (the owner); more can be added later (§5, §12 Q2).
**Approved 2026-11-02 (owner):** authentication = **WordPress cookie session**, signed in with **email + password** or **Sign in with Google / Microsoft** (server-side OAuth 2.0 Authorization Code + PKCE, OpenID Connect). All three end in the same WordPress session (§4, §4.4). Other §12 decisions are still open.
**Date:** 2026-11-02 · **Branch:** `feature/members-portal`
**Inputs read:** `docs/members-portal/WORDPRESS-AUDIT.md` (primary source; moved here from `docs/brothers-151-members-portal-readiness-audit.md`), `docs/security-architecture.md`, `docs/wordpress-operations.md`, `docs/graphql-contract.md`, `wordpress/mu-plugins/bo151-api-hardening.php`, the Angular source. There is **no `CLAUDE.md`** in the repository (noted; nothing to follow there).

Owner decisions already recorded in the audit and applied here:

- Members log in to the **member-only area of the public site** and **never** reach the WordPress backend. Only named people get "super access" (backend + member area). (Audit §0.1)
- Candidates come from **New Prospects** records; a workflow moves them to membership records. (Audit §16.8)
- Every member has a permanent **membership number**, used to validate Zoom attendees. (Audit §16.9)
- Multi-chapter from day one; roster, history archive, founders' interviews and (last) the education module system are coming. (Audit §16)

---

## 1. Findings (what exists today)

| Area | Finding | Source |
|---|---|---|
| WordPress | 7.1.4, PHP 8.3.36 (LiteSpeed), MySQL 5.7.44, single site, HostGator shared hosting | Audit §2 |
| Backend code in the repo | Only one MU-plugin: `bo151-api-hardening.php` (hides users from anonymous REST/GraphQL; CORS allow-list) | Repo |
| Roles | WordPress defaults only; 1 user (administrator); registration off | Audit §6 |
| GraphQL | WPGraphQL 2.26.0 + WPGraphQL for ACF 3.1.0; introspection off for the public; depth 15; batching 10; complexity analyzer off | Audit §4 |
| Public GraphQL used by Angular | `pages`, `page(idType: URI)`, `homepageCarousels`, `events`/`event`, `posts`/`post` | `src/app/Services/wp-queries.ts` |
| Auth | Simple-JWT-Login 3.6.8 with password→JWT `/auth` **enabled**, WPGraphQL integration on; no 2FA; no login throttling; `xmlrpc.php` on | Audit §5 |
| CORS | MU-plugin echoes only allow-listed origins. **No `Access-Control-Allow-Credentials`**; GraphQL `Allow-Headers` lacks `X-WP-Nonce` | MU-plugin source |
| Caching | `/graphql` responses carry `Cache-Control: max-age=86400` from the **host** (not the MU-plugin); no page/object cache | Audit §4, §0.2 |
| Files | Media Library is fully public (60 items listed anonymously) | Audit §8 |
| Email | No SMTP; PHP `mail()` only | Audit §9 |
| Custom post types | `events` (public, ACF "Event Group": `startTime`, `endTime`, `eventImage`, +2), `homepage-carousel`, `brothers` (REST-exposed, unused), `new-prospects` (REST-exposed, 9 ACF fields, 0 published) | Audit §2, §0.2 |
| Environments | Production `tzin.brothersof1-5-1.org`; staging `…/staging/1848` (Newfold; separate DB) | `wordpress-operations.md` |
| Earlier plan | `security-architecture.md` proposed JWT in memory + refresh cookie. **This design replaces that with WordPress cookie sessions** (reasons in §4.1). |

**Origins:** frontend `https://brothersof1-5-1.org`, backend `https://tzin.brothersof1-5-1.org` → **same-site, cross-origin**, both HTTPS. This is the key fact behind the session design.

---

## 2. Plugin architecture

A new regular plugin (not MU), so it can be activated, deactivated and rolled back from wp-admin:

```
wordpress/plugins/brothers-151-members/
  brothers-151-members.php        bootstrap, constants, autoload, activation/deactivation hooks
  includes/
    class-plugin.php              wires modules together; feature flags per module
    class-roles.php               roles + capabilities (install/upgrade/uninstall-safe)
    class-membership.php          status model, membership numbers, chapters, status transitions
    class-access.php              single place for "can this viewer see X" (capability + status + scope + visibility)
    class-backend-gate.php        blocks /wp-admin + admin bar for non-backend users; login/logout redirects
    class-session-api.php         REST: login, logout, me, password reset/change (rate-limited); inactivity timeout
    class-two-factor-enforcement.php  requires 2FA (Two Factor plugin) for every backend-capable account
    class-oauth.php               Sign in with Google / Microsoft (Authorization Code + PKCE, OIDC ID-token validation, account linking)
    class-rate-limiter.php        per-IP and per-username counters (transients)
    class-cors.php                credentialed CORS for the exact frontend origins (coordinates with the MU-plugin)
    class-cache-headers.php       private/no-store for authenticated requests and all member endpoints
    class-graphql.php             registers types, fields, connections, mutations (delegates to modules)
    class-directory.php           member directory queries (curated fields, visibility, pagination limits)
    class-member-events.php       private member-event CPT
    class-announcements.php       private announcement CPT
    class-resources.php           private documents: storage, metadata CPT, download endpoint
    class-prospects.php           prospect → candidate → member workflow (Checkpoint 3+)
    class-admin.php               wp-admin screens: roster columns/filters, approvals, status actions, settings
    class-notifications.php       transactional emails (templates; uses wp_mail)
    class-audit-log.php           custom table, writer, admin viewer, retention
  templates/emails/*.php
  uninstall.php                   removes roles/caps only when explicitly chosen (keeps data by default)
  tests/                          PHPUnit (WordPress test suite) + HTTP smoke tests for staging
  README.md
```

- The existing MU-plugin stays (hardening). Two changes are needed there and are listed in §11 (credentials + `X-WP-Nonce` for allow-listed origins; one owner of CORS headers to avoid duplicates).
- Text domain `b151`, prefix `b151_`, PHP 8.1+ syntax, WordPress coding standards.
- Every module can be switched off by a constant/option, so Checkpoints 2 and 3 can ship separately.

---

## 3. Data model

All data lives in the existing WordPress database. **No second database.**

### 3.1 Identity and membership (WordPress users + user meta)

| Key | Type | Notes |
|---|---|---|
| WordPress user | `wp_users` | Identity, email, password hash, `display_name` |
| `b151_status` | `pending` \| `active` \| `inactive` \| `suspended` | **Separate from role.** Default `pending`. Only `active` (or backend roles, see §5) passes member checks |
| `b151_classification` | `member` \| `life_member` \| `honorary` | **Decided:** all three. Classification is informational/administrative (shown in the roster; filterable); access is still decided by status + capabilities. Candidates use the separate `b151_candidate` role, not a classification |
| `b151_membership_number` | string, unique, permanent | **Decided format: `151-NNNNN`** — a national sequence, zero-padded to 5 digits (`151-00001` … `151-99999`), enough for the current ~130 brothers with ample room; revisit only if the organisation approaches 100,000 members. Assigned on admission (next free number) or set once on import for existing brothers; never reused; uniqueness enforced in code + table (3.4) |
| `b151_chapter_id` | int (post ID of `b151_chapter`) | Every user has one chapter |
| `b151_approved_at`, `b151_approved_by` | datetime, user ID | Set on approval |
| `b151_status_changed_at`, `b151_status_reason` | datetime, text | Last change; full history in the audit log |
| `b151_joined_on` | date (optional) | Organisation join/initiation date |
| `b151_line` | text (optional) | Line name/number |
| `b151_display_name` | text | Name shown in the directory |
| `b151_photo_id` | int (private resource) | Profile photo, stored privately (§3.3) — **not** the public Media Library |
| `b151_bio` | text (optional) | |
| Contact fields | `b151_phone`, `b151_address_*` | Personal data; never public |
| `b151_visibility` | JSON map field → `members` \| `admins` | Directory sharing choices. **Decided default:** display name, chapter, year (join/initiation year) and the **Active** indicator are visible to members; everything else (email, phone, address, bio, photo, line, classification) is `admins` until the brother opts in |
| `b151_dues_status` *(later)* | `current` \| `lapsed` \| `exempt` + `b151_dues_paid_through` (date) | **Planned (owner, 2026-11-02): "active" will also depend on dues.** Not built now. When added, the directory's Active indicator = membership status `active` **and** dues `current`/`exempt` (Life Members and Honorary can be `exempt`). Whether lapsed dues also removes portal access is an open question (§12 Q10) |
| `b151_profile_updated_at` | datetime | |
| `b151_prospect_id` | int | Link to the New Prospects record it came from (§3.5) |

ACF PRO can render these fields in wp-admin (user-location field group), but **ACF's own GraphQL exposure stays off** for them; GraphQL access goes only through the plugin's checked resolvers.

### 3.2 Chapters

`b151_chapter` private post type (`public => false`, `show_in_rest => false`, `show_in_graphql => false`): name, code, location, status. Exposed to GraphQL only as a small `MemberChapter` type through checked resolvers.

### 3.3 Private content types (all `public => false`, `publicly_queryable => false`, `exclude_from_search => true`, `show_in_rest => false`, no ACF/WPGraphQL auto-exposure)

| Type | Fields | Notes |
|---|---|---|
| `b151_member_event` | title, description, start, end, location, virtual meeting info (link/ID/passcode), visibility (`members` / `chapter` / `admins`), chapter (optional), status | **Decided: separate private type**, apart from the public `events` type, so private details can never leak through existing public queries, REST, feeds or sitemaps. The public Events section and pages are unchanged |
| `b151_announcement` | title, content, published, author, visibility, chapter (optional), expires_at | Separate from the public blog |
| `b151_resource` | title, description, category, visibility, chapter (optional), private file reference (path, MIME, size, checksum, original name) | Files stored privately (§7) |

### 3.4 Plugin tables (created on activation with `dbDelta`)

| Table | Purpose |
|---|---|
| `{prefix}b151_audit_log` | id, occurred_at, actor_user_id, action, target_type, target_id, ip_hash, details (JSON, no secrets/PII beyond IDs) |
| `{prefix}b151_member_numbers` | membership_number (UNIQUE), user_id, assigned_at — guarantees uniqueness and "never reused" at the database level |

Rate-limit counters use transients (no table).

### 3.5 Prospects → candidates → members (audit §16.8)

The existing `new-prospects` records stay the intake record. The workflow (Checkpoint 3 or later) links prospect ↔ user both ways and changes the **same** WordPress user from candidate to member on admission; membership number assigned then. Prerequisite: list the 9 prospect fields (audit §14 item 7) and remove `new-prospects` from public REST (§11).

### 3.6 Dues-ready design (decisions deferred, no recoding later)

The owner will decide the dues rules later (§12 Q10). To avoid recoding, Checkpoint 2 builds the **extension points only** — no dues screens, no payment processing:

1. **One eligibility function.** Every "is this brother active / may he see member content?" check goes through a single policy in `class-access.php` (`b151_member_standing( $user_id )` → `{ is_active, has_member_access, reasons[] }`). The directory's Active indicator, resolvers and the login gate all call it. Changing the dues rules later changes this one policy (driven by settings), not dozens of checks.
2. **Settings with safe defaults** (Members → Settings, off until decided):
   - *Dues affect:* `nothing` (default, today's behaviour) · `active indicator only` (option a: keeps access, shows not active) · `indicator and member content` (option b: loses member content until paid; profile, password, logout and "pay dues" stay available).
   - *Exempt classifications:* checkboxes for Life Member and Honorary (default unchecked until decided).
   - *Grace period* after the paid-through date (default 0 days).
3. **Data fields reserved now:** `b151_dues_status` (`current` / `lapsed` / `exempt`), `b151_dues_paid_through` (date) and a `dues_payments` record shape (amount, date, period, **source** `manual` | `square`, reference, recorded_by). Stored but unused until the dues phase.
4. **Payment source is a field**, so manual recording (admin form) and automatic recording (Square webhook later, matched by email/membership number) use the same records; adding Square later is new input code, not a data change.
5. **Audit log** already records status changes, so dues-driven changes will be logged the same way.

Deciding later then means: choose the settings, and build the payment-recording screen (manual) and/or the Square connection — without changing the access checks, directory, resolvers or data model.

---

## 4. Authentication and session design

### 4.1 Decision: WordPress cookie sessions (not JWT)

| | WordPress cookie session (recommended) | JWT (Simple-JWT-Login, earlier plan) |
|---|---|---|
| Session secret readable by JavaScript | **No** (HttpOnly) | Access token yes; refresh token cookie-based in the earlier plan |
| Revocation on suspension | **Immediate** (`WP_Session_Tokens::destroy_all()` + status check on every request) | Only after the access token expires |
| Reuses WordPress | Login, sessions, password hashing, reset keys, roles | Plugin-specific; 3.x with v4 pending; email in payload |
| CSRF | Needs nonce + Origin check (built into WordPress REST: `X-WP-Nonce`) | Not needed |
| Works here because | Frontend and backend are **same-site** (`*.brothersof1-5-1.org`), so cookies are sent on credentialed requests regardless of SameSite=Lax | — |

No custom cryptography: login uses `wp_signon()`; sessions use WordPress auth cookies and session tokens; CSRF uses `wp_create_nonce( 'wp_rest' )` / `X-WP-Nonce`; password reset uses `get_password_reset_key()` / `check_password_reset_key()` / `reset_password()`.

### 4.2 Flow

1. **Login** — Angular `POST https://tzin.brothersof1-5-1.org/wp-json/b151/v1/session` with `credentials: 'include'`, body `{ login, password }`.
   - Origin must be allow-listed; rate limiter checked first (per IP and per username).
   - `wp_signon()`; then the `authenticate` filter rejects users who are not `active` (or backend roles) with the **same generic error** as a wrong password.
   - On success WordPress sets its HttpOnly, Secure auth cookies on `tzin.brothersof1-5-1.org`. Response: `{ member: { … minimal … }, nonce }`, `Cache-Control: no-store`.
2. **Every later call** (GraphQL and REST) sends `credentials: 'include'` + `X-WP-Nonce: <nonce>`. The nonce is kept **in memory only** (never `localStorage`); after a page reload Angular calls `GET /session` (cookie only) to get a fresh nonce.
3. **`GET /wp-json/b151/v1/session`** — returns `{ authenticated, member, nonce }` or `{ authenticated: false }`. Safe to call without a nonce because it returns only the caller's own minimal data.
4. **Logout** — `DELETE /session` (with nonce): `wp_logout()` + destroy the current session token; Angular clears its in-memory state and any member data it holds.
5. **Password reset** — `POST /session/password-reset` `{ login }` always returns the same response (no enumeration), rate-limited; WordPress generates the key; the email links to the **Angular** page `https://brothersof1-5-1.org/reset-password?key=…&login=…` (via the `retrieve_password_message` / `lostpassword_url` filters) so members never see `wp-login.php`. `POST /session/password-reset/confirm` `{ login, key, password }` → `check_password_reset_key()` + `reset_password()` + destroy all sessions.
6. **Password change** — `POST /session/password` (nonce) `{ current, new }` → verify current, update, destroy other sessions.

Why session endpoints are REST rather than GraphQL mutations: precise control of cookies, status codes, rate limiting and `no-store` headers, and the login call can't carry a nonce yet. All **member data** operations are GraphQL (§6). `currentMember` and `sessionStatus` are also offered in GraphQL for convenience.

### 4.3 Protections (apply to every sign-in method)

| Requirement | Design |
|---|---|
| Session expiry | **Decided: inactivity logout.** Each session token stores `b151_last_activity`; every authenticated request checks it. If idle longer than the limit, the session is destroyed and the request is treated as logged out. Activity updates are written at most once every 5 minutes. Defaults (configurable in Members → Settings): **30 minutes idle** for members, **15 minutes idle** for backend-capable accounts, plus an absolute maximum of **12 hours** per session (`auth_cookie_expiration`). No "remember me". Angular shows a "You'll be signed out in 2 minutes — Stay signed in" prompt; only real user activity (clicks, typing, navigation) keeps the session alive, not background polling |
| Revocation after suspension | Status change → `destroy_all()`; every resolver re-checks status, so access ends on the next request even if a cookie survives |
| Rate limiting | Per IP and per username: e.g. 5 failures / 15 min → 15-min lock; exponential back-off; also applied to reset requests. Counters store hashes, not raw IPs |
| Account enumeration | Same message and timing for unknown user, wrong password, pending, suspended; reset always "If an account exists…" |
| CSRF | `X-WP-Nonce` required on every authenticated state-changing request (WordPress REST does this natively; WPGraphQL requires it for cookie auth — **to confirm on staging**, §10) + Origin header must match the allow-list |
| CORS | Exact origins only, `Access-Control-Allow-Credentials: true` only for those, `Allow-Headers` incl. `X-WP-Nonce`, `Vary: Origin`; never `*` |
| Cookies | WordPress sets `Secure` + `HttpOnly`; SameSite default (Lax) is correct for same-site use. `COOKIE_DOMAIN` stays unset (cookies only for `tzin…`) |
| Other login paths | Disable `xmlrpc.php`; turn off Simple-JWT-Login `/auth` (or remove the plugin) once cookie login works — **approval needed** |
| 2FA | **Decided: required for every backend-capable account** (§4.5) |
| Backend gate | Users without `b151_backend_access` are redirected from `/wp-admin` (except `admin-ajax.php`/`admin-post.php`), admin bar hidden, `login_redirect`/`logout_redirect` → public site |

### 4.4 Sign in with Google / Microsoft (approved)

Social sign-in only proves **who** someone is. Whether he gets in is still decided by WordPress: linked member, status `active`, capabilities. It never creates accounts.

**Standard used:** OAuth 2.0 **Authorization Code flow with PKCE** + **OpenID Connect**, handled entirely by WordPress (server side). Client secrets never reach the browser. No custom cryptography: the ID token is validated with a maintained library (e.g. `firebase/php-jwt` against the provider's published keys, or the provider's official PHP client), bundled in the plugin's `vendor/` (HostGator has no Composer).

**Flow:**

1. Angular login page → button **Sign in with Google** / **Sign in with Microsoft** → `GET https://tzin.brothersof1-5-1.org/wp-json/b151/v1/oauth/{provider}/start?return=/members`.
2. WordPress creates `state`, `nonce` and a PKCE `code_verifier` (stored server-side in a short-lived transient keyed by a random, HttpOnly, Secure, SameSite=Lax cookie), validates `return` against an allow-list of member-area paths, and redirects to the provider's authorization page with `scope=openid email profile`.
3. The provider redirects back to `…/wp-json/b151/v1/oauth/{provider}/callback?code=…&state=…`.
4. WordPress checks `state`, exchanges `code` + `code_verifier` (+ client secret) **server-to-server**, validates the ID token: signature (provider keys), `iss`, `aud` = our client ID, `exp`/`iat`, `nonce`, and `email_verified` (Google; for Microsoft use the verified-email claim rules for personal vs. work accounts).
5. **Find the member:**
   - Already linked → user with meta `b151_oauth_google_sub` / `b151_oauth_microsoft_oid` (+ `tid`) equal to the token's subject.
   - Not linked yet → a user whose WordPress email **exactly matches** the provider's **verified** email → link it (store the subject) and audit-log "linked Google/Microsoft".
   - No match → generic "This account isn't registered with 1-5-1" page; **no account created**.
6. Apply the same gate as password login (status `active`, rate limits), then `wp_set_auth_cookie()` → redirect to `https://brothersof1-5-1.org/<return>`. Angular then calls `GET /session` to get the nonce, exactly as after a password login.

**Rules:**

- **Member area only.** Accounts with `b151_backend_access` (portal/membership/content admins, WP administrators) may use social sign-in for the member area, but `/wp-admin` still requires WordPress password + 2FA (`wp-login.php`). The provider's own 2FA can't be verified.
- **Linking/unlinking** from the member's profile (`myMemberProfile` shows linked providers; `unlinkSignInProvider(provider)` mutation, requires a recent password or social re-authentication). Admins can unlink in wp-admin.
- **Email changes:** after linking, the provider subject is used, so a changed email doesn't break sign-in and can't be used to take over another account.
- **Password stays available** for every member; social sign-in is optional.
- Suspension destroys sessions as usual; a suspended member's Google/Microsoft sign-in is refused at step 6.

**Provider setup (free; owner action, with guidance):**

| Provider | Where | Settings |
|---|---|---|
| Google | Google Cloud Console → APIs & Services → OAuth consent screen + Credentials → OAuth client ID (Web) | Consent screen: External, app name "Brothers of 1-5-1", scopes `openid email profile` only (no Google verification review needed). Authorized redirect URIs: `https://tzin.brothersof1-5-1.org/wp-json/b151/v1/oauth/google/callback` and the staging equivalent |
| Microsoft | Microsoft Entra admin center → App registrations → New registration | Supported account types: **personal Microsoft accounts and any organization** (`common`). Redirect URI (Web) as above with `/microsoft/callback`. Client secret with a calendar reminder before it expires |

Client IDs and secrets go in `wp-config.php` constants (`B151_GOOGLE_CLIENT_ID`, `B151_GOOGLE_CLIENT_SECRET`, `B151_MICROSOFT_CLIENT_ID`, `B151_MICROSOFT_CLIENT_SECRET`), **never** in the repo, the database options UI or Angular.

**Hosting check (staging):** WordPress must be able to make outbound HTTPS requests to `oauth2.googleapis.com`, `www.googleapis.com` and `login.microsoftonline.com`. Usually allowed on HostGator; verified on staging before relying on it.

**Additional tests** (added to §10): invalid/missing `state`; replayed `code`; wrong `aud`/`iss`; expired token; unverified email; unknown account (no account created); pending/suspended member refused; first-login linking by verified email; subject-based login after an email change; `return` parameter can't redirect off-site; backend-capable account still can't open `/wp-admin` without password + 2FA.

**Later (optional, same design):** Facebook, Apple ($99/year), passkeys.

**Tests added for these decisions:** idle session expires after the limit (member 30 min, backend 15 min) and is destroyed server-side; activity within the limit keeps it alive; absolute 12 h maximum; backend-capable account without 2FA can't reach any `/wp-admin` page except 2FA enrolment; backend login requires the second step; member (no backend access) never prompted for 2FA; membership numbers are `151-NNNNN`, sequential, unique, never reused; classification values limited to member / life_member / honorary.

### 4.5 Two-step login (2FA) for admins (decided)

- **Who:** every account with `b151_backend_access` (WP Administrator, Portal/Membership/Content Admins, later Dean). Members: not required (can be offered later).
- **How:** the free, well-maintained **Two Factor** plugin (wordpress.org/plugins/two-factor, maintained by WordPress core contributors) provides the second step on `wp-login.php`: **authenticator app codes (TOTP)** as the main method, **backup codes** for recovery, and email codes as a fallback. Using an established component avoids writing custom authentication/crypto code.
- **Enforcement (in this plugin, `class-two-factor-enforcement.php`):** the Two Factor plugin makes 2FA optional; the portal plugin makes it **mandatory** for backend-capable accounts:
  - A backend-capable user without 2FA set up can only reach their own profile screen to enrol; every other `/wp-admin` page redirects there with a notice.
  - Granting a backend role to someone puts them in this "enrol first" state.
  - Social sign-in (Google/Microsoft) never opens `/wp-admin`; backend access always goes through password + 2FA.
  - Disabling 2FA on a backend account is blocked (only a WP Administrator can reset another user's 2FA, audit-logged).
- **Recovery:** each admin stores their backup codes safely. If the only administrator loses their device and codes, recovery is via cPanel/database (documented in DEPLOYMENT.md) — so the owner should keep backup codes offline.
- **Fallback if the plugin is unsuitable** (found during staging): TOTP built into the portal plugin using a maintained RFC 6238 library (e.g. `spomky-labs/otphp`), same enforcement rules.

---

## 5. Roles and capability matrix

Roles are bundles of capabilities; **all checks use capabilities**, never role names. Status is checked separately.

| Capability | Member | Membership Admin | Content Admin | Portal Admin ("super access") | WP Administrator | Candidate *(later)* | Dean *(later)* |
|---|---|---|---|---|---|---|---|
| `read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `b151_view_member_content` | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| `b151_view_directory` | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| `b151_edit_own_profile` | ✓ | ✓ | ✓ | ✓ | ✓ | limited | ✓ |
| `b151_backend_access` (may open wp-admin) | — | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| `b151_manage_members` (view roster incl. contact data, edit records) | — | ✓ | — | ✓ | ✓ | — | — |
| `b151_approve_members` / `b151_change_member_status` | — | ✓ | — | ✓ | ✓ | — | — |
| `b151_export_roster` | — | ✓ | — | ✓ | ✓ | — | — |
| `b151_verify_members` (Zoom host lookup) | — | ✓ | ✓ | ✓ | ✓ | — | — |
| `b151_manage_member_events` | — | — | ✓ | ✓ | ✓ | — | — |
| `b151_manage_announcements` | — | — | ✓ | ✓ | ✓ | — | — |
| `b151_manage_resources` | — | — | ✓ | ✓ | ✓ | — | — |
| `b151_view_audit_log` | — | ✓ | — | ✓ | ✓ | — | — |
| `b151_assign_backend_roles` (grant super access) | — | — | — | — | ✓ | — | — |
| Site editing (`edit_posts`, `edit_pages`, `upload_files`) | — | — | ✓ | ✓ | ✓ | — | — |
| Plugins, themes, settings, users (core) | — | — | — | — | ✓ | — | — |
| `b151_manage_education` *(Checkpoint later)* | — | — | — | ✓ | ✓ | — | ✓ |
| `b151_view_education` *(later)* | — | — | — | ✓ | ✓ | ✓ (released modules only) | ✓ |

Rules:

- **Member-content checks = capability AND status `active`.** Backend roles (Membership/Content/Portal Admin, WP Administrator, Dean) are treated as active for viewing member content, but their own `b151_status` is still recorded.
- Role names: `b151_member`, `b151_membership_admin`, `b151_content_admin`, `b151_portal_admin`, later `b151_candidate`, `b151_dean`, optional `b151_chapter_admin` (chapter-scoped variants of membership capabilities).
- Only WP Administrators can assign any role with `b151_backend_access`; every grant/removal is audit-logged.
- **Initial assignment (owner decision 2026-11-02):** one admin only, the owner's existing WP Administrator account. Membership Admin, Content Admin and Portal Admin roles are created by the plugin but left empty until the owner adds people.
- Ordinary members never receive any core editing capability.

---

## 6. GraphQL operation inventory

All new fields are registered with `register_graphql_object_type`, `register_graphql_field`, `register_graphql_connection` and `register_graphql_mutation` (WPGraphQL 2.x). Existing public operations are untouched.

**Every private resolver runs, in order:** (1) authenticated? (2) eligible status? (3) capability? (4) resource-level access (visibility, chapter scope)? (5) field-level visibility. Failures return `null`/empty for reads and a generic `FORBIDDEN` error for mutations — never a hint about existence.

| Operation | Kind | Who | Notes |
|---|---|---|---|
| `currentMember` | query | any logged-in user | Own minimal record: id, displayName, status, roles/caps summary, membership number, chapter |
| `sessionStatus` | query | anyone | `{ authenticated, expiresAt }`; no personal data |
| `myMemberProfile` | query | `b151_edit_own_profile` | Full own profile incl. own contact data and visibility settings |
| `updateMyMemberProfile` | mutation | `b151_edit_own_profile` | **Allow-list** of editable fields (display name, bio, phone, address, visibility, photo); status, number, chapter, role are never editable here |
| `memberDirectory(first, after, search, chapterId)` | connection | `b151_view_directory` + active | Lists brothers with portal accounts (not pending/suspended); each entry shows display name, chapter, year and **`isActive`** (today: membership status `active`; later: also dues current, §3.1), plus any fields the brother opted in to; max 25 per page; search ≥ 2 chars; per-user rate limit |
| `memberProfile(id)` | query | `b151_view_directory` + active | Same visibility rules as the directory; no email unless shared |
| `pendingMembers(first, after)` | connection | `b151_approve_members` | |
| `approveMember(userId, classification?)` | mutation | `b151_approve_members` | pending → active; assigns membership number if missing; email; audit |
| `suspendMember(userId, reason)` / `reactivateMember` / `deactivateMember` | mutation | `b151_change_member_status` | Destroys sessions; email; audit |
| `verifyMember(membershipNumber)` | query | `b151_verify_members` | Returns only name, chapter, active yes/no; rate-limited; logged (Zoom check-in) |
| `memberEvents(first, after, from, to)` / `memberEvent(id)` | connection / query | `b151_view_member_content` + active | Visibility + chapter scope; virtual meeting details only here |
| `memberAnnouncements(first, after)` / `memberAnnouncement(id)` | connection / query | same | Expired announcements hidden |
| `memberResources(first, after, category)` / `memberResource(id)` | connection / query | same | Returns metadata + `downloadUrl` (the REST download route; see §7) — never a file path or public URL |

Content admins create/edit events, announcements and resources in **wp-admin** (native screens), so no content mutations are needed in GraphQL for Checkpoint 3.

**GraphQL hardening alongside:** turn on the query analyzer (complexity limit), consider depth 10 and batching 5 (or off), keep introspection off for the public.

---

## 7. Protected resources (private files)

- **Storage:** a folder **outside the web root**, e.g. `/home1/<cpanel-user>/b151-private/` (path configured in `wp-config.php`, not hard-coded). **Prerequisite (audit §14 item 3): verify this folder can be created and read by PHP.** If not possible, Checkpoint 3 stops before file delivery and documents the limitation (fallback discussed then; a "hidden" Media Library URL is **not** acceptable).
- **Upload:** wp-admin form on the `b151_resource` screen; server checks MIME (allow-list: PDF, DOCX, XLSX, PPTX, JPG/PNG, MP3/M4A, MP4), size limit (host cap 64 MB), random stored filename, checksum.
- **Download:** `GET /wp-json/b151/v1/resources/{id}/download?_wpnonce=<nonce>` — cookie + WordPress REST nonce (core mechanism; `_wpnonce` works for links/`<audio src>`). Checks status, capability, visibility, chapter scope; streams with `Content-Disposition`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`, and **HTTP Range** support (for audio/video seeking). Every download is audit-logged.
- Profile photos use the same storage, served through a size-limited variant of the same endpoint.

---

## 8. Caching (public vs. private)

| Traffic | Rule |
|---|---|
| Anonymous GraphQL (public site) | Unchanged: current behaviour, runtime content refresh, existing Angular caching plan |
| Any request with a logged-in user | Plugin sends `Cache-Control: private, no-store, max-age=0` and `Vary: Origin, Cookie` (via `graphql_response_headers_to_send` and `rest_post_dispatch`). **Must override the host's `max-age=86400`** — verify on staging that the host doesn't re-add it (if it does: `.htaccess` `Header` rule scoped to `/graphql` with a cookie condition, approval needed) |
| Session endpoints, member REST, downloads | Always `no-store` |
| Angular (later phase) | Member queries use credentialed POST, never the HTTP transfer cache, never prerendered, never persisted to `localStorage`; in-memory member cache cleared on logout and on user change |
| Shared caches | No CDN in front today; Endurance page cache is disabled. If either is enabled later, bypass on cookies / `/graphql` POST |

---

## 9. Administration (wp-admin)

- **Users screen** extended: columns for membership number, chapter, status; filters by status/chapter; row actions Approve / Suspend / Reactivate; bulk actions; status-change reason prompt.
- **Member profile screen** (user edit): membership section (status, classification, chapter, number read-only after assignment, visibility, contact fields).
- **Members → Pending** screen for approvals; **Members → Audit log** viewer (filter by action/date/user); **Members → Settings** (session length, rate limits, frontend URL, email sender).
- Native CPT screens for member events, announcements, resources.
- Roster CSV export (capability-checked, logged).

---

## 10. Testing strategy

**Automated (PHPUnit with the WordPress test suite, run locally or in CI against a throw-away database):**

1. Anonymous → every private field/connection returns null/empty; mutations FORBIDDEN.
2. Pending, inactive, suspended → same as anonymous for member content; login rejected with the generic error.
3. Active member → own profile, directory (filtered by visibility), events/announcements/resources per visibility and chapter.
4. Member → admin mutations rejected; `updateMyMemberProfile` ignores/rejects non-allow-listed fields (status, number, role, chapter).
5. Field-level: hidden phone/address/email never returned via `memberDirectory`, `memberProfile`, `users`, `user`, `viewer`, `node(id:)` or REST.
6. Status change destroys sessions; next request denied.
7. Approval by a non-approver rejected; approval assigns a unique number; numbers never reused.
8. Rate limiter locks after N failures (per IP and per username) and unlocks after the window.
9. Password reset: same response for unknown users; key flow via core functions; sessions destroyed after reset.
10. Backend gate: member redirected from `/wp-admin/`, `/wp-admin/profile.php`; admin bar hidden; `admin-ajax.php` still works.
11. Cache headers: authenticated responses `no-store`; anonymous public responses unchanged.
12. Public GraphQL operations used by Angular (`pages`, `page`, `homepageCarousels`, `events`, `event`, `posts`, `post`) return the same shapes as before (snapshot tests).
13. Private CPTs absent from public REST, GraphQL, search, feeds and sitemaps.

**Staging smoke tests (scripted HTTP, low volume, never against production):** real cookies across `brothersof1-5-1.org`-style origin → staging, nonce behaviour in WPGraphQL 2.26, CORS preflights, host cache headers, private file download incl. Range, direct-URL denial.

Angular unit tests continue to run (`ng test`) to prove the public site is unaffected.

**Environment note:** the WordPress PHPUnit suite needs PHP + MySQL; confirm at Checkpoint 2 whether it runs in this workspace (otherwise via a local `wp-env`/Docker setup on your Mac or a CI job).

---

## 11. Deployment strategy

1. Build and test locally; then **staging only** (`/staging/1848`): upload the plugin zip in wp-admin → activate → run the smoke tests.
2. Production, with approval, in this order: backup (DB + `wp-content`) → MU-plugin update (credentials/nonce header) → upload plugin (inactive) → activate → create the first portal admin(s) → verify public site and GraphQL → turn off Simple-JWT `/auth` and xmlrpc → remove `new-prospects`/`brothers` from public REST.
3. **Rollback:** deactivate the plugin (data stays; public site unaffected); restore the previous MU-plugin file; if needed restore the DB backup. Uninstall never deletes member data unless an explicit option is set.
4. Nothing reaches production without your explicit approval at each step; never use HostGator's "Deploy all changes".

Required configuration changes (each needs approval): SMTP (FluentSMTP / WP Mail SMTP + domain sender + SPF/DKIM/DMARC); MU-plugin CORS credentials + `X-WP-Nonce`; xmlrpc off; Simple-JWT `/auth` off; GraphQL analyzer on; `new-prospects`/`brothers` `show_in_rest=false`; `wp-config.php` constants (`DISALLOW_FILE_EDIT`, `WP_MEMORY_LIMIT` 256M, private storage path); 2FA for backend accounts.

---

## 12. Decisions needed before Checkpoint 2

1. ~~**Approve the authentication design** (§4)~~ **Approved 2026-11-02:** WordPress cookie session with email + password, Sign in with Google and Sign in with Microsoft (§4.4). Simple-JWT-Login `/auth` turned off once this works (separate approval at deployment).
2. ~~**Roles** (§5)~~ **Decided 2026-11-02:** build **all** tiers (Membership Admin, Content Admin, Portal Admin = both, WP Administrator) so more people can be added later without code changes. **For now there is one admin: the owner (Kenneth), using his existing WordPress Administrator account**, which receives every `b151_*` capability. Other roles stay unassigned until needed; adding someone later = WP Administrator assigns the role in wp-admin → Users (audit-logged; 2FA required for any backend-capable account).
3. ~~**Classifications**~~ **Decided:** Member, Life Member, Honorary (all three).
4. ~~**Membership number format**~~ **Decided:** `151-NNNNN` (5-digit national sequence; ~130 members today; revisit near 100,000). **Still open:** do existing brothers already have numbers to keep, or should the import assign `151-00001`… in roster order?
5. ~~**Session length**~~ **Decided:** log out after inactivity — 30 min members, 15 min backend accounts, 12 h absolute maximum, no "remember me" (all configurable).
6. ~~**2FA**~~ **Decided:** required for every backend-capable account, using the free Two Factor plugin with enforcement in the portal plugin (§4.5).
7. ~~**Email sender**~~ **Done 2026-11-02:** WordPress now sends through the HostGator mailbox `noreply@brothersof1-5-1.org` with the free **FluentSMTP** plugin (SMTP over SSL, port 465, From forced to `noreply@brothersof1-5-1.org` / "Brothers of 1-5-1", email logging on). DNS: SPF and DKIM already existed; **DMARC added** (`v=DMARC1; p=none; rua=mailto:noreply@brothersof1-5-1.org`, verified in public DNS). The portal's notification module uses `wp_mail()`, so it goes through this automatically. Watch: HostGator's hourly sending limit (fine for transactional mail, not for bulk mailings).
8. ~~**Member events**~~ **Decided:** separate private type `b151_member_event` (recommended option).
9. ~~**Directory defaults**~~ **Decided:** name, chapter, year and an **Active** indicator shown by default; everything else only if the brother opts in.
10. **Deferred by the owner (2026-11-02): dues rules.** Decided later: (a) does a lapsed-dues brother keep portal access but show as not active, or lose member content until he pays; (b) who records payments (admin by hand, or automatically from the Pay Dues Square checkout); (c) are Life Members and Honorary exempt. **The design keeps all three as settings, not code (§3.6), so deciding later doesn't require recoding.**

## 13. Security risks (to resolve in the phases shown)

| Risk | Phase |
|---|---|
| Password→JWT endpoint and xmlrpc open, no throttling/2FA | Before member accounts exist (Checkpoint 2 deploy) |
| Host `max-age=86400` on `/graphql` | Checkpoint 2 (override + staging verification) |
| Public Media Library | Design constraint (private storage, §7) |
| No SMTP | Before invitations (Checkpoint 3) |
| `new-prospects`/`brothers` in public REST | Before any prospect/member data (Checkpoint 2 deploy) |
| Default WordPress lets any logged-in user open wp-admin | Checkpoint 2 (backend gate) |
| No GraphQL complexity limit | Checkpoint 2 deploy |
| Backups unverified | Before production deploy |
| Private-folder support unverified | Before Checkpoint 3 file delivery |

## 14. Implementation phases (estimate)

| Checkpoint | Scope | Rough size |
|---|---|---|
| 2 — Core backend | Plugin skeleton, roles/caps, status model, chapters, membership numbers, backend gate, session REST API (login/logout/me/reset/change), Sign in with Google/Microsoft (§4.4), rate limiter, CORS/no-store headers, approval/suspend mutations, `currentMember`/`sessionStatus`/`myMemberProfile`/`updateMyMemberProfile`/`pendingMembers`, audit log, PHPUnit suite + staging smoke tests | Largest phase |
| 3 — Member features | Directory + `verifyMember`, private member events, announcements, protected resources (if private storage verified), wp-admin screens, email notifications, roster export | Medium–large |
| 4 — Deployment prep | Plugin zip, HostGator steps, config checklist, backup/rollback, Angular integration guide (`ANGULAR-INTEGRATION.md`) | Small |
| Later (audit §16) | Prospect → candidate → member workflow, history archive + founders' interviews, education modules (Dean, intake classes, tests) | Separate approvals |

---

**Checkpoint 1 complete. Waiting for approval of §4 (authentication) and answers to §12 before writing any implementation code.**

---

## Progress

| Checkpoint | Status |
|---|---|
| 1 — Design | Approved |
| 2 — Core backend | Built and tested (PHPUnit). **Staging: installed 2026-11-02 (0.4.1), smoke test 32/32 incl. signed-in member.** |
| 3 — Member features | Built and tested (PHPUnit): member events (meeting links members-only), announcements (pin/expiry), resources with private file storage outside the web root and a checked download endpoint (Range, audit), directory + profile (opt-in fields, rate limit), `verifyMember` for Zoom check-in, 1-5-1 Members admin menu (pending approvals, roster CSV export, audit log, settings), approval/paused/restored emails. Lists use `first`/`offset` paging. Profile photos deferred. Awaiting review. |
| 4 — Deployment prep | Built: `scripts/package-plugin.sh` (upload zip), `scripts/portal-smoke-test.sh` (read-only HTTP checks, optional test-member sign-in), `DEPLOYMENT.md` (staging → production steps, config checklist, rollback), `ANGULAR-INTEGRATION.md`, and pre-launch hardening in the plugin (§13 risks: XML-RPC, JWT password endpoint, prospects/brothers REST, username enumeration, backend noindex, GraphQL depth/batching). Verified end to end over real HTTP on a local WordPress (31/31 checks). **Staging install done 2026-11-02:** 22/22 signed-out + 10/10 signed-in checks on HostGator (CORS, HttpOnly+Secure cookie, nonce/CSRF, host max-age overridden, wp-admin gate, hardening). Membership numbers can be set/corrected for existing brothers (0.4.1). |

