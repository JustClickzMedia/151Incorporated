# WordPress Operations

## Environments

| | URL | Notes |
|---|---|---|
| Production | `https://tzin.brothersof1-5-1.org` | Document root `~/tzin.brothersof1-5-1.org` |
| Staging | `https://tzin.brothersof1-5-1.org/staging/1848` | Created 2026-10-28 with the HostGator Staging tool (Newfold). Document root `~/tzin.brothersof1-5-1.org/staging/1848`. It has its own database copy and logins (same credentials as at clone time) |
| `tzinprivate.brothersof1-5-1.org` | Not related | A separate default HostGator WordPress site (no ACF or GraphQL). **Not** staging |

## Backups

- **Automatic:** HostGator Basic Backup runs weekly (portal → Websites → tzin → **Backups**). Restore options cover the whole site, files only, or the database only.
- **Before any production change:**
  1. Check that the "Last Backup" date is recent. If it isn't, download a database backup (Backups → Database Backups → Download) and a `wp-content` archive (cPanel → File Manager → compress `wp-content` → download).
  2. Copy any config file you're about to touch (for example `.htaccess` → `.htaccess.bak-YYYYMMDD`).
- **Never** commit `wp-config.php`, database dumps, or `.env` files to Git.

## Restore procedure (untested; test it on staging first)

1. Portal → Backups → **Database Backups** → choose a date → Restore. This rolls back **all** content changes made after that date.
2. Portal → Backups → **File Backups** → choose a date and path (for example `wp-content/mu-plugins`) → Restore.
3. Verify the REST API, GraphQL, wp-admin login and the Angular homepage.

## Staging rules

- **Never click "Deploy all changes"** on the HostGator Staging screen. It copies the staging database and files over production.
- "Clone to staging" overwrites staging with production. Use it to refresh staging before a new round of work.
- Promote changes to production **by hand, one setting at a time**, with owner approval.

## Promotion checklist (staging → production), pending approval

1. Confirm a recent backup.
2. Upload `wordpress/mu-plugins/bo151-api-hardening.php` to `~/tzin.brothersof1-5-1.org/wp-content/mu-plugins/`.
3. Simple JWT Login → CORS → **No** → Save.
4. WPGraphQL Settings: tick **Limit query depth** (15) and untick **Delete Data on Deactivation** → Save.
5. ACF → Post Types:
   - **Events:** GraphQL single `event`, plural `events`.
   - **Homepage Carousel:** plural `homepageCarousels`.
   - **This step changes production GraphQL names.** Do it only when Angular is ready, or before Angular ships any GraphQL code.
6. Verify:
   - Anonymous `users` returns empty.
   - `/wp-json/wp/v2/users` returns 404.
   - Angular pages still load.
   - A request from a non-approved origin is blocked.

## Known operational notes

- The HostGator plugin (`wp-plugin-hostgator`) appears to have been switched on in production when the Staging tool was opened from the HostGator portal (2026-10-28). It's required by the Staging tool.
- WordPress core auto-updated from 7.1.3 to 7.1.4 between 2026-10-26 and 2026-10-28.
- The staging `error_log` shows a harmless `nfd_data_sync_cron` schedule warning from the HostGator plugin.
