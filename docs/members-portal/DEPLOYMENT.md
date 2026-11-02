# Members Portal — Deployment (Checkpoint 4)

How to install the `brothers-151-members` WordPress plugin: **staging first**, production only after the staging
checks pass and you approve. The Angular site is not touched by any of this.

> **Never click "Deploy all changes" on the HostGator Staging screen.** It copies the whole staging site over
> production. Production gets its own install, by the steps in §5.

---

## 1. Before you start

| Check | How | Why |
|---|---|---|
| Fresh backup | cPanel → **Backup** (or JetBackup) → download a full account backup. Keep it off the server. | Rollback if anything goes wrong. No backup plugin is installed today. |
| PHP 8.1+ | wp-admin → Tools → Site Health → Info → Server. (8.3 confirmed 2026-11.) | The plugin needs PHP 8.1. |
| WPGraphQL active | Plugins screen | The member area talks to GraphQL. |
| Email works | FluentSMTP → Email Test | Approval and password-reset emails. Done 2026-11-02. |

## 2. Staging install (about 20 minutes)

Staging admin: `https://tzin.brothersof1-5-1.org/staging/1848/wp-admin`

1. **Install Two Factor.** Plugins → Add New Plugin → search **Two Factor** (by WordPress.org Contributors) →
   Install → Activate.
2. **Set up two-step sign-in on your own admin account now.** Users → Profile → *Two-Factor Options*: turn on
   **Authenticator app** (scan the QR code with Google Authenticator, Authy or 1Password), then **Backup Verification
   Codes** → generate and **save the codes somewhere safe**. Make Authenticator app the primary method → Update Profile.
   Once the portal plugin is active, admin pages send any admin account without two-step sign-in to this screen
   until it is done. You are never locked out: the profile page always works.
3. **Create the private file folder.** cPanel → File Manager → your **home folder** (the one that *contains*
   `public_html`, not inside it) → **+ Folder** → `b151-private-staging`. Production will use `b151-private` later.
   The folder must be outside `public_html`; the plugin refuses a folder inside the website.
4. **Add the settings to staging's `wp-config.php`.** File Manager → the staging site's folder → `wp-config.php` →
   Edit. Above the line `/* That's all, stop editing! */` add (replace `<cpanel-user>` with your cPanel user name,
   shown at the top of File Manager's folder tree):

   ```php
   /* Brothers of 1-5-1 members portal */
   define( 'B151_PRIVATE_DIR', '/home1/<cpanel-user>/b151-private-staging' );
   if ( ! defined( 'WP_ENVIRONMENT_TYPE' ) ) { define( 'WP_ENVIRONMENT_TYPE', 'staging' ); } // also allows http://localhost:4200 for Angular development
   ```

   Google / Microsoft sign-in constants come later (§6). Never put any of these in the repository.
5. **Build the plugin zip** on your Mac:

   ```bash
   cd ~/Development/151Incorporated
   bash scripts/package-plugin.sh     # → dist/brothers-151-members-<version>.zip
   ```

6. **Upload and activate.** Staging wp-admin → Plugins → Add New Plugin → **Upload Plugin** → choose the zip →
   Install Now → **Activate**. A new **1-5-1 Members** menu appears.
7. **Settings.** 1-5-1 Members → Settings: *Private file folder* must show the path with a ✓. Leave every
   protection on (§4).
8. **Chapters.** 1-5-1 Members → Chapters → add each chapter.

## 3. Staging checks

**Automatic (read-only, safe):**

```bash
bash scripts/portal-smoke-test.sh https://tzin.brothersof1-5-1.org/staging/1848
```

Every line must say PASS. It checks the session API, CORS (front end allowed, other sites refused), no-store caching,
that member content and downloads are closed to guests, that public content still works, and every protection in §4.

**Signed in, with a TEST member account:**

1. Users → Add New User: a test address you can read, role **Member (1-5-1)**. Set a password of 12+ characters.
2. 1-5-1 Members → **Pending approvals** → Approve. The approval email (with a membership number) should arrive.
3. Run: `bash scripts/portal-smoke-test.sh https://tzin.brothersof1-5-1.org/staging/1848 --member`
   and type the test account's email and password when asked (nothing is shown or saved). This checks sign-in,
   the HttpOnly + Secure cookie, GraphQL with the cookie + nonce, that a cookie *without* the nonce is treated as a
   guest, that the host's `max-age=86400` is overridden for signed-in GraphQL, the wp-admin gate and sign-out.
4. Content: add a Member Event (with a Zoom link), an Announcement and a Resource with a small PDF. In Settings the
   folder still shows ✓; in File Manager the PDF appears in `b151-private-staging` under a random name.
5. Audit log (1-5-1 Members → Audit log) shows the approval, sign-ins and uploads.

Tested end to end on a local WordPress over real HTTP on 2026-11-02: all 31 checks passed.

**After cloning production to staging:** FluentSMTP shows *"Authentication unique keys and salts are changed"*
(staging has its own WordPress keys). Re-enter the mailbox password in Settings → FluentSMTP on staging, then send an
Email Test; until then staging emails are not sent (`member_notified … "sent":false` in the audit log).

**Existing brothers' numbers:** type the number they already have in the *Member #* box on Pending approvals, or in
*Membership number* on their profile. Blank = next free number (after the highest in use). Changing a number frees
the old one; changes are audit-logged.

## 4. What the protections change

All are on by default and can be switched off one by one in 1-5-1 Members → Settings.

| Protection | Effect | Could affect |
|---|---|---|
| XML-RPC off | Removes a password-guessing route that skips throttling and two-step sign-in | The WordPress mobile app, Jetpack (neither is in use) |
| Simple-JWT-Login password endpoint off | `/wp-json/simple-jwt-login/v1/auth` gone | Nothing: the Angular site reads public content anonymously; members use the cookie session |
| New Prospects / Brothers private | Out of `/wp/v2` and GraphQL | Nothing in the Angular site uses them |
| Usernames hidden | `?author=N` → 404; no users in the backend sitemap | — |
| Backend not indexed | No `wp-sitemap.xml` on tzin, `X-Robots-Tag: noindex` | tzin pages leave Google over time (intended: the public site is brothersof1-5-1.org with its own sitemap) |
| GraphQL limits | Depth ≤ 10, no batched queries | Nothing: the site's deepest query is 7 levels, one query per request |

After the cookie session is proven on staging, plan to **deactivate Simple-JWT-Login** entirely (audit §13).

## 5. Production (separate approval)

Same steps as §2–3 on `https://tzin.brothersof1-5-1.org/wp-admin`, with folder `b151-private` and without the
`WP_ENVIRONMENT_TYPE` line (production must not allow `localhost:4200`). Before it:

- [ ] Staging checks in §3 all pass
- [ ] Fresh production backup downloaded
- [ ] Your production admin account has two-step sign-in and saved backup codes
- [ ] Angular member area deployed or ready (otherwise members have nowhere to sign in yet)
- [ ] Ask HostGator about moving MySQL 5.7 (end of life) to 8.0

## 6. Google and Microsoft sign-in (optional, after staging works)

Register one web app with each provider. Redirect (callback) addresses:

| Provider | Staging | Production |
|---|---|---|
| Google (console.cloud.google.com → APIs & Services → Credentials → OAuth client ID, *Web application*) | `https://tzin.brothersof1-5-1.org/staging/1848/wp-json/b151/v1/oauth/google/callback` | `https://tzin.brothersof1-5-1.org/wp-json/b151/v1/oauth/google/callback` |
| Microsoft (entra.microsoft.com → App registrations → *Accounts in any organizational directory and personal Microsoft accounts*, platform *Web*) | `…/staging/1848/wp-json/b151/v1/oauth/microsoft/callback` | `…/wp-json/b151/v1/oauth/microsoft/callback` |

Then add to that site's `wp-config.php` (never the repository):

```php
define( 'B151_GOOGLE_CLIENT_ID', '…' );     define( 'B151_GOOGLE_CLIENT_SECRET', '…' );
define( 'B151_MICROSOFT_CLIENT_ID', '…' );  define( 'B151_MICROSOFT_CLIENT_SECRET', '…' );
```

`GET …/wp-json/b151/v1/oauth/providers` then lists the provider. The first sign-in links by the member's verified
email (Google, personal Microsoft accounts); work/school Microsoft accounts are linked from the member's profile.
If sign-in fails with `provider_error`, check that the host allows outbound HTTPS to `oauth2.googleapis.com`,
`www.googleapis.com` and `login.microsoftonline.com`.

## 7. Rollback

- **Turn it off:** Plugins → *Brothers of 1-5-1 Members Portal* → Deactivate. The site returns to its previous
  behaviour (including the protections in §4). Members, numbers, content, files and the audit log are **kept**, so
  re-activating picks up where it left off.
- **Something worse:** restore the backup from §1.
- Deleting the plugin from the Plugins screen does not delete member data either; removing that data is a separate,
  deliberate step (ask before doing it).

## 8. Configuration checklist

| Setting | Where | Staging | Production |
|---|---|---|---|
| `B151_PRIVATE_DIR` | wp-config.php | `/home1/<user>/b151-private-staging` | `/home1/<user>/b151-private` |
| `WP_ENVIRONMENT_TYPE` | wp-config.php | `staging` | leave unset (= production) |
| `B151_GOOGLE_CLIENT_ID` / `_SECRET` | wp-config.php | staging app | production app |
| `B151_MICROSOFT_CLIENT_ID` / `_SECRET` | wp-config.php | staging app | production app |
| Front-end address (links in emails, redirects) | built in: `https://brothersof1-5-1.org` | same | same |
| Idle sign-out, session length, lockout, password length, upload size, emails, protections | 1-5-1 Members → Settings | defaults | defaults |
| Two Factor plugin + your 2FA | Plugins / Profile | required | required |
| FluentSMTP | Settings | working | working |
