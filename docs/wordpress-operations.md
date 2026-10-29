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

## Homepage carousel images (Homepage Carousel type)

**Current behaviour (2026-10-29, Richmond-style banner):**

- The homepage uses **only `desktopLandscapeImage`**, the same photo on every screen.
- The photo fills a banner that keeps its shape (about 2.2:1 on desktop and tablet, 1.75:1 on phones), cropped evenly from the centre, with a maroon tint.
- So upload a **wide photo with the subjects in the middle**, at least 1920×1080; ideally 2480×1120 (2.2:1).
- The other five fields are ignored for now; the table below applies only if per-screen images are turned back on.

Each carousel item has six images. In the earlier per-screen mode, the site showed exactly the image uploaded for the visitor's screen size. **Frame each image so the whole subject is visible at that shape.**

| Field (case-sensitive) | Used on | Shape | Upload size (sharp on 2×/3× screens) |
|---|---|---|---|
| `mobileportraitimage` | Phones, portrait | 9:16 | 1080 × 1920 |
| `mobileLandscapeImage` | Phones, landscape | 3:2 | 1440 × 960 |
| `tabletportraitimage` | Tablets, portrait | 601:962 (≈ 5:8) | 1202 × 1924 |
| `tabletlandscapeimage` | Tablets, landscape (≤ 1280 px) | 4:3 | 2048 × 1536 |
| `desktopportraitImage` | Laptops (≤ 1440 px) | 1024:493 (≈ 2.08:1) | 2592 × 1248 |
| `desktopLandscapeImage` | Large screens | 16:9 | 1920 × 1080 (or 2560 × 1440) |

- An image with a different shape still shows in full, with thin dark-red bars on two sides.
- Fill in the **alt text** in the Media Library (for example, "Three brothers at the 2019 reunion"). It's empty today, so the slide title is used.
- After uploading, check the homepage at phone and desktop widths. Chrome DevTools' device toolbar works for this.
- Today's uploads (2026-10-28):
  - The phone images are 320–360 px wide and the desktop images are 1024 px wide, so they look soft.
  - The phone images for "Membership Requirements" and "Scholarship" are tight crops of one person.
  - The Bismarck phone image is 2:3, not 9:16.
