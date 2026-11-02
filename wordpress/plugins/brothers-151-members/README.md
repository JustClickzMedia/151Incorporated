# Brothers of 1-5-1 Members Portal (WordPress plugin)

Backend for the members-only area. Design and decisions: `docs/members-portal/ARCHITECTURE.md`.
Status: **Checkpoints 2–3 (core backend + member features)** — not yet installed on staging or production.

## What it does

| Area | Summary |
|---|---|
| Membership | Status (`pending`/`active`/`inactive`/`suspended`) separate from roles; classification (member, life member, honorary); permanent numbers `151-NNNNN`, never reused; chapters (private type). |
| Roles | Member, Membership Admin, Content Admin, Portal Admin; WordPress Administrator gets every plugin capability. Checks always use capabilities. |
| Sign-in | WordPress cookie session (HttpOnly). Email + password via REST; Google / Microsoft via server-side OpenID Connect (code + PKCE). No tokens in JavaScript or localStorage; Angular only receives a WordPress nonce. |
| Sessions | Idle sign-out 30 min (members) / 15 min (admin accounts); 12 h maximum; passive polling (`X-B151-Activity: passive`) never extends a session. |
| Admin safety | Members cannot open wp-admin. Admin actions need a session from wp-login.php with two-step sign-in (Two Factor plugin); member-area sessions never carry admin power. |
| API | REST `b151/v1/session…`, `b151/v1/oauth/{google,microsoft}/{start,callback}`, `b151/v1/resources/{id}/download`; GraphQL `currentMember`, `portalSessionStatus`, `myMemberVisibility`, `pendingMembers`, `updateMyMemberProfile`, `approveMember`, `suspendMember`, `reactivateMember`, `deactivateMember`, plus `memberDirectory`, `memberProfile`, `verifyMember`, `memberEvents`/`memberEvent`, `memberAnnouncements`/`memberAnnouncement`, `memberResources`/`memberResource`. |
| Audit | Security-relevant actions logged in `{prefix}b151_audit_log` (no passwords/tokens; IPs hashed). |
| Member content | Private member events (with meeting links), announcements (pin, expiry) and resources; each for all members or one chapter. Not public, not in the public REST API or GraphQL schema. |
| Private files | Resource files stored outside the web root (`B151_PRIVATE_DIR`), type/content/size checked, served only by `b151/v1/resources/{id}/download` after access checks, with Range support; every download logged. |
| Directory | `memberDirectory` (active brothers, 25 per page, search, chapter filter, rate-limited), `memberProfile`; contact fields only when a brother opts in. |
| Zoom check-in | `verifyMember(membershipNumber)`: name, chapter, active — admin session, rate-limited, logged. |
| Admin | "1-5-1 Members" menu: pending approvals, events, announcements, resources, chapters, roster CSV export (formula-safe, logged), audit log, settings. |
| Emails | Approval (with membership number), paused, restored — on/off in settings. |

## Requirements

WordPress 6.6+, PHP 8.1+, WPGraphQL, Two Factor (free, wordpress.org). `vendor/` bundles firebase/php-jwt 6.11.1 (BSD-3-Clause).

## Configuration (wp-config.php only — never in the repository)

```php
define( 'B151_GOOGLE_CLIENT_ID', '…' );
define( 'B151_GOOGLE_CLIENT_SECRET', '…' );
define( 'B151_MICROSOFT_CLIENT_ID', '…' );
define( 'B151_MICROSOFT_CLIENT_SECRET', '…' );
define( 'B151_PRIVATE_DIR', '/home1/<cpanel-user>/b151-private' ); // outside public_html
```

Providers without both constants are simply not offered. Other settings: **1-5-1 Members → Settings** in wp-admin.

## Tests

Runs against the WordPress core PHPUnit suite (a throwaway test database — never a real site):

```bash
WP_TESTS_DIR=/path/to/wordpress-develop/tests/phpunit \
WP_TESTS_CONFIG_FILE_PATH=/path/to/wp-tests-config.php \
WP_TESTS_PHPUNIT_POLYFILLS_PATH=/path/to/phpunit-polyfills \
B151_WPGRAPHQL_DIR=/path/to/wp-graphql B151_TWO_FACTOR_DIR=/path/to/two-factor \
phpunit
```
