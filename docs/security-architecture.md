# Security Architecture

## Current controls (staging, 2026-10-28)

All of these are implemented in the must-use plugin `wordpress/mu-plugins/bo151-api-hardening.php`, plus settings changes:

| Control | How it works | Verified |
|---|---|---|
| Hide user accounts from anonymous visitors | REST `/wp/v2/users*` routes are removed when logged out. GraphQL `UserObject` is private when logged out | `users` → `[]`; REST → 404 |
| CORS allow-list | Only `https://brothersof1-5-1.org`, `https://www.brothersof1-5-1.org` and `http://localhost:4200` are allowed. It replaces core's echo-any-origin behaviour and WPGraphQL's `*` | The live origin is allowed; `www.hostgator.com` is blocked |
| Simple JWT Login CORS (`*`, all methods) | Turned **off**; the mu-plugin now owns CORS | Settings saved |
| GraphQL query depth limit | On, maximum 15 | An over-depth query is rejected |
| Introspection for logged-out visitors | Off (unchanged) | Rejected |
| Drafts and private content | WPGraphQL default (not public) | A `status: DRAFT` query returns `[]` |
| "Delete data on deactivation" | Off | Saved |

**Still open:**

- Batch requests are on (maximum 10). Consider turning them off if Angular doesn't use batching.
- There's no GraphQL response caching yet (evaluate WPGraphQL Smart Cache).
- `localhost:4200` should be removed from the production allow-list unless it's needed.
- New Prospects (9 ACF fields, likely personal data) is REST-enabled with 0 posts. **Disable `show_in_rest` before any prospect data is collected.**

## Future members portal (planning only; not implemented)

**Principle:** every private record is authorized **on the server** by WordPress capabilities. Angular only decides what to display, never who may see it.

**Recommended architecture:**

1. **Identity:** WordPress users with custom roles: `member`, `chapter_officer`, `national_admin`. Disable open registration, and have an admin invite members.
2. **Login:**
   - Use a dedicated auth flow. Either WPGraphQL JWT Authentication, or Simple-JWT-Login v4 hardened with a strong secret, short access tokens and refresh rotation.
   - Store the access token in memory and the refresh token in an **HttpOnly, Secure, SameSite cookie**, not `localStorage`.
   - Add 2FA for officers and admins.
   - Rate-limit login attempts.
3. **Authorization:**
   - Register the private types (roster, member profiles, announcements, documents, calendar) with `public => false`. Expose them in GraphQL only through resolvers that check `current_user_can()`.
   - Field-level checks apply to PII such as phone, email and address.
4. **Private documents:**
   - Store them outside the public `uploads` folder, or behind a PHP download gate that checks the capability.
   - Never put a public `sourceUrl` on a private file.
5. **Admin functions:** use wp-admin for officers where possible. Any GraphQL mutations must check capabilities and nonces/tokens and be logged.
6. **Transport:** HTTPS only. CORS allow-list with credentials only for the production origin.
7. **Audit and privacy:** log logins, role changes and document access. Keep minimal PII, and have a written retention policy.

**Not sufficient on its own:** installing a JWT plugin, or hiding menu items in Angular.
