# Change Log

## 2026-10-26 — Phase 1 discovery (read-only)

- **Branch:** none yet. The repo wasn't accessible; the plan is to commit on `chore/backend-graphql-audit`.
- **Files added:** `docs/backend-audit.md`, `docs/project-status.md`, `docs/change-log.md`
- **WordPress/production changes:** none
- **Reason:** first deliverable. Audit the backend before any installation.
- **Testing:**
  - Anonymous REST via `rest_route`: OK
  - Pretty `/wp-json/`: 404
  - GraphQL via `/index.php?graphql`: OK
  - Anonymous introspection: blocked
  - Anonymous user enumeration: exposed
- **Outstanding issues:** blockers B1–B6 in `backend-audit.md`
- **Follow-up, same day:** with owner approval I investigated the `/wp-json/` outage. I confirmed the weekly HostGator backup from 2026-10-26 00:58 EDT exists, and read `.htaccess` (no changes; it's correct). A re-test found the REST API healthy, so **no production change was made**. The homepage still fails because of the missing page 13 (B2).
- **Next steps (original):** owner review → production REST fix (approval) → backups → staging

## 2026-10-28 — Phase 1 docs committed

- **2026-10-28** · branch `chore/backend-graphql-audit` · files added: `docs/backend-audit.md`, `docs/change-log.md`, `docs/project-status.md` (local commit only; not pushed)
- **Update:** Kenneth later pushed these files, and they are now on `master`.

## 2026-10-28 — Staging created and GraphQL hardening (staging only)

- **Branch:** `chore/backend-graphql-hardening` (uploaded through the GitHub web UI)
- **Environment:** staging `https://tzin.brothersof1-5-1.org/staging/1848`. **No production settings were changed.**
- **Changes on staging:**
  1. Created staging with the HostGator Staging tool.
  2. ACF post types:
     - Events GraphQL names `events/events` → `event/events`.
     - Homepage Carousel plural `homepageCarousel` → `homepageCarousels`.
  3. WPGraphQL: query depth limit on (15). "Delete data on deactivation" off.
  4. Simple JWT Login: CORS off.
  5. New mu-plugin `wp-content/mu-plugins/bo151-api-hardening.php`, which hides users from anonymous visitors and adds the CORS allow-list.
- **Files added to the repo:**
  - `wordpress/mu-plugins/bo151-api-hardening.php`
  - `docs/graphql-contract.md`
  - `docs/ANGULAR-HANDOFF.md` (start here for Claude Desktop)
  - `docs/wordpress-operations.md`
  - `docs/security-architecture.md`
- **Files updated:** `docs/change-log.md`, `docs/project-status.md`
- **Testing (anonymous, staging):**
  - Pages, carousels, events and posts queries work.
  - Users: `[]`.
  - REST users: 404.
  - Drafts: `[]`.
  - Depth 15 enforced.
  - Allowed origin OK; other origin blocked.
  - REST pages still 200.
  - No new PHP errors.
- **Side effect noted:** the HostGator plugin appears to have been switched on in production when the Staging tool was opened.
- **Outstanding:** homepage slug decision; promotion to production (approval needed); batching and caching decisions; disable REST for New Prospects.
- **Next steps:** owner review → Angular builds against the staging contract → promote to production. → production REST fix (approval) → backups → staging
