# Brothers of 1-5-1 Members Portal (WordPress plugin)

Backend for the members-only area. Design and decisions: `docs/members-portal/ARCHITECTURE.md`.
Status: **Checkpoint 2 (core backend)** — not yet installed on staging or production.

## What it does

| Area | Summary |
|---|---|
| Membership | Status (`pending`/`active`/`inactive`/`suspended`) separate from roles; classification (member, life member, honorary); permanent numbers `151-NNNNN`, never reused; chapters (private type). |
| Roles | Member, Membership Admin, Content Admin, Portal Admin; WordPress Administrator gets every plugin capability. Checks always use capabilities. |
| Sign-in | WordPress cookie session (HttpOnly). Email + password via REST; Google / Microsoft via server-side OpenID Connect (code + PKCE). No tokens in JavaScript or localStorage; Angular only receives a WordPress nonce. |
| Sessions | Idle sign-out 30 min (members) / 15 min (admin accounts); 12 h maximum; passive polling (`X-B151-Activity: passive`) never extends a session. |
| Admin safety | Members cannot open wp-admin. Admin actions need a session from wp-login.php with two-step sign-in (Two Factor plugin); member-area sessions never carry admin power. |
| API | REST `b151/v1/session…`, `b151/v1/oauth/{google,microsoft}/{start,callback}`; GraphQL `currentMember`, `portalSessionStatus`, `myMemberVisibility`, `pendingMembers`, `updateMyMemberProfile`, `approveMember`, `suspendMember`, `reactivateMember`, `deactivateMember`. |
| Audit | Security-relevant actions logged in `{prefix}b151_audit_log` (no passwords/tokens; IPs hashed). |

## Requirements

WordPress 6.6+, PHP 8.1+, WPGraphQL, Two Factor (free, wordpress.org). `vendor/` bundles firebase/php-jwt 6.11.1 (BSD-3-Clause).

## Configuration (wp-config.php only — never in the repository)

```php
define( 'B151_GOOGLE_CLIENT_ID', '…' );
define( 'B151_GOOGLE_CLIENT_SECRET', '…' );
define( 'B151_MICROSOFT_CLIENT_ID', '…' );
define( 'B151_MICROSOFT_CLIENT_SECRET', '…' );
```

Providers without both constants are simply not offered. Other settings: **Settings → Members Portal**.

## Tests

Runs against the WordPress core PHPUnit suite (a throwaway test database — never a real site):

```bash
WP_TESTS_DIR=/path/to/wordpress-develop/tests/phpunit \
WP_TESTS_CONFIG_FILE_PATH=/path/to/wp-tests-config.php \
WP_TESTS_PHPUNIT_POLYFILLS_PATH=/path/to/phpunit-polyfills \
B151_WPGRAPHQL_DIR=/path/to/wp-graphql B151_TWO_FACTOR_DIR=/path/to/two-factor \
phpunit
```
