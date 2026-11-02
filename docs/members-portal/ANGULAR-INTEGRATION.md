# Members Portal — Angular Integration Guide

> **Status (2026-11-02): built** on branch `feature/members-area` — `src/app/Services/portal/` (PortalApiService,
> IdleService, guards, queries) and `src/app/Components/members/` (sign-in, reset password, dashboard, events,
> announcements, resources, directory, brother profile, my profile). The "Member Login" menu item is controlled by
> `environment.membersEnabled` (off in production until go-live). Dev: `ng serve` proxies `/staging/1848` to staging
> (`proxy.portal.json`).

How the Angular site (brothersof1-5-1.org) talks to the members-portal plugin on WordPress (tzin). The plugin enforces
every rule; Angular only decides what to show. Server contract: `wordpress/plugins/brothers-151-members/`.

## 1. Principles

- **Session = WordPress HttpOnly cookies** set by tzin. JavaScript never sees them. Nothing secret goes in
  `localStorage`/`sessionStorage`.
- **Every portal request** sends cookies (`withCredentials: true`) and the header `X-WP-Nonce: <nonce>`. Without the
  nonce WordPress treats the request as a guest (CSRF protection), so a missing nonce looks like "signed out".
- **Public pages stay as they are.** The existing `GraphqlService` keeps sending anonymous requests without cookies.
  Member data goes through a separate `PortalApi` so public responses stay cacheable.
- **Server-side rendering / prerender:** never call portal endpoints on the server. Member routes render in the
  browser only (`RenderMode.Client`) and are never listed in `prerender-routes.txt`.

## 2. Configuration

```ts
// environment.prod.ts (staging: https://tzin.brothersof1-5-1.org/staging/1848)
portalApiUrl: 'https://tzin.brothersof1-5-1.org',          // REST: `${portalApiUrl}/wp-json/b151/v1/...`
portalGraphqlUrl: 'https://tzin.brothersof1-5-1.org/graphql',
```

Allowed browser origins: `https://brothersof1-5-1.org`, `https://www.brothersof1-5-1.org`, and
`http://localhost:4200` on non-production WordPress only. Requests from anywhere else get 403.

## 3. Endpoints

| Call | Request | Response |
|---|---|---|
| Who am I (on app start, after sign-in redirects) | `GET /wp-json/b151/v1/session` | `{ authenticated:false }` or `{ authenticated:true, nonce, member, idle_seconds_remaining, idle_limit_seconds, warning_seconds:120, expires_at, admin_session }` |
| Sign in | `POST /wp-json/b151/v1/session` `{ username, password }` (username may be the email) | `201` same shape as above · `401 b151_invalid_login` (one message for every failure) · `429 b151_too_many_attempts` · `403 b151_use_admin_sign_in` + `data.sign_in_url` (admin accounts with two-step sign-in: send them to that URL) |
| Sign out | `DELETE /wp-json/b151/v1/session` + nonce | `{ authenticated:false }` |
| Forgot password | `POST /wp-json/b151/v1/session/password-reset` `{ email }` | always `202` with the same message |
| Reset from email link | page `/members/reset-password?login=…&key=…` → `POST …/session/password-reset/confirm` `{ login, key, password }` | `200` · `400 b151_reset_invalid` · `400 b151_weak_password` |
| Change password | `POST …/session/password` `{ current_password, new_password }` + nonce | `200` with a **new nonce** (other devices are signed out) |
| Google / Microsoft | full-page navigation to `GET …/oauth/{google|microsoft}/start?return=/members/events` | ends on `https://brothersof1-5-1.org<return>`; on failure `/members/sign-in?error=<code>` |
| Which providers are on | `GET …/oauth/providers` | `{ providers: [{ id, label }] }` (show only these buttons) |
| Link Google/Microsoft to my account | navigate to `…/oauth/{provider}/start?mode=link&return=/members/profile` while signed in | back to `return` |
| Download a resource | use `downloadUrl` from GraphQL as a normal link / `<audio src>` | file (`Range` supported) · `401`/`404` |

OAuth error codes for `/members/sign-in?error=`: `provider_unavailable`, `too_many_attempts`, `invalid_request`,
`cancelled`, `provider_error`, `no_account`, `not_active`, `already_linked`, `sign_in_first`. Show friendly text;
`no_account` = "No member account uses that address. Contact info@brothersof1-5-1.org."

## 4. GraphQL operations

Send to `portalGraphqlUrl` with cookies + `X-WP-Nonce`. Fields a viewer may not see come back `null`.

```graphql
query Me { currentMember { id displayName email membershipNumber status classification chapter { id name }
  joinedYear phone address1 address2 city state postalCode bio line } myMemberVisibility { field audience } }

query Status { portalSessionStatus { authenticated idleSecondsRemaining expiresAt adminSession } }

mutation SaveProfile($input: UpdateMyMemberProfileInput!) { updateMyMemberProfile(input: $input) { member { id displayName } } }
# input: displayName, bio, phone, address1, address2, city, state, postalCode, joinedYear, line,
#        visibility: [{ field: "phone"|"email"|"address"|"bio"|"line"|"classification", audience: "members"|"admins" }]

query Directory($first: Int, $offset: Int, $search: String, $chapterId: Int) {
  memberDirectory(first: $first, offset: $offset, search: $search, chapterId: $chapterId) {
    total nodes { id displayName chapter { name } joinedYear isActive phone email city state } } }
query Brother($id: Int!) { memberProfile(id: $id) { id displayName chapter { name } joinedYear isActive bio phone email } }

query Events($first: Int, $offset: Int, $includePast: Boolean) {
  memberEvents(first: $first, offset: $offset, includePast: $includePast) {
    total nodes { id title startsAt endsAt location isVirtual virtualUrl meetingId passcode imageUrl contentHtml chapter { name } } } }
query Announcements { memberAnnouncements(first: 20) { total nodes { id title date pinned expiresOn contentHtml } } }
query Resources($category: String) { memberResources(first: 50, category: $category) {
  total nodes { id title category fileName fileSize mimeType downloadUrl updatedAt } } }

# Admin screens (only work with an admin session from wp-login.php + two-step sign-in; `admin_session: true`)
query Pending { pendingMembers(first: 50) { id displayName email } }
mutation Approve($id: Int!) { approveMember(input: { userId: $id, classification: MEMBER }) { member { id membershipNumber } } }
query Verify($n: String!) { verifyMember(membershipNumber: $n) { found displayName chapter { name } isActive } }
```

Paging is `first` / `offset` (directory max 25 per page; others 50). Directory search needs at least 2 letters.
`contentHtml` is sanitized on the server; bind with `[innerHTML]`.

## 5. Session handling in Angular

```ts
// portal-api.ts — the only place that talks to the portal
@Injectable({ providedIn: 'root' })
export class PortalApi {
  private http = inject(HttpClient);
  private nonce = signal<string | null>(null);
  readonly member = signal<Member | null>(null);

  session(passive = false) {
    return this.http.get<SessionResponse>(`${env.portalApiUrl}/wp-json/b151/v1/session`, {
      withCredentials: true,
      headers: passive ? { 'X-B151-Activity': 'passive' } : {},
    }).pipe(tap(r => this.apply(r)));
  }
  signIn(username: string, password: string) {
    return this.http.post<SessionResponse>(`${env.portalApiUrl}/wp-json/b151/v1/session`, { username, password },
      { withCredentials: true }).pipe(tap(r => this.apply(r)));
  }
  graphql<T>(query: string, variables = {}) {
    return this.http.post<{ data: T; errors?: unknown[] }>(env.portalGraphqlUrl, { query, variables }, {
      withCredentials: true, headers: { 'X-WP-Nonce': this.nonce() ?? '' },
    });
  }
  private apply(r: SessionResponse) { this.nonce.set(r.authenticated ? r.nonce : null); this.member.set(r.authenticated ? r.member : null); }
}
```

- **App start** (browser only): call `session()` once. Members are signed in if it says so.
- **Expired or invalid nonce** (REST `403 rest_cookie_invalid_nonce`, GraphQL `403`): call `session()` once for a
  fresh nonce and retry the request once; if still not signed in, go to `/members/sign-in`.
- **Idle sign-out** (server limit: 30 min members, 15 min admin accounts; 12 h max):
  - Track real user activity (click, key, touch, scroll) in the browser.
  - While the user is active, call `session()` (a normal, non-passive request) at most every 5 minutes; any other
    portal request also counts as activity on the server.
  - Show the warning when `idle_seconds_remaining` (re-read with `session(true)` — passive, does **not** extend the
    session) drops below `warning_seconds` (120). "Stay signed in" → `session()`; ignore → at 0, sign out locally
    and show the sign-in page with "You were signed out after 30 minutes without activity."
  - Never poll with non-passive requests in the background: that would keep idle sessions alive.
- **Sign out:** `DELETE …/session` with the nonce, then clear `member` and navigate to `/`.
- **Route guard:** `/members/**` (except `/members/sign-in` and `/members/reset-password`) requires `member()`;
  it's only for convenience, the server re-checks everything.

## 6. Pages to build

| Route | Content |
|---|---|
| `/members/sign-in` | email + password; Google / Microsoft buttons from `oauth/providers`; forgot-password link; `?error=` messages |
| `/members/reset-password` | new password (12+ characters) from the email link |
| `/members` | dashboard: welcome, membership number, pinned announcements, next events |
| `/members/profile` | edit profile, share/hide settings, change password, link Google/Microsoft |
| `/members/directory` | search, chapter filter, 25 per page |
| `/members/events`, `/members/events/:id` | member events (meeting links only here) |
| `/members/announcements` | list |
| `/members/resources` | list by category, download links |

`robots.txt` has `Disallow: /members$` and `Disallow: /members/` (not a bare `/members` prefix, which would also hide `/membership`), the sitemap skips it, and the pages are `noindex` (`SeoService.apply({ noindex: true })`).

## 7. Testing locally

WordPress cookies are `SameSite=Lax` (browser default). That works in production because brothersof1-5-1.org and
tzin.brothersof1-5-1.org are the *same site*. From `http://localhost:4200` a request to tzin is *cross-site*, so the
browser won't send the cookies and you'd never stay signed in. Use the Angular dev-server proxy so the portal looks
same-origin during development:

```json
// proxy.portal.json  →  ng serve --proxy-config proxy.portal.json
{ "/staging/1848": { "target": "https://tzin.brothersof1-5-1.org", "secure": true, "changeOrigin": true } }
```

```ts
// environment.ts (development)
portalApiUrl: '/staging/1848',
portalGraphqlUrl: '/staging/1848/graphql',
```

The proxy forwards the browser's `Origin: http://localhost:4200`, which staging allows (never production). Sign in
with a test member. Never point a local build at production.
