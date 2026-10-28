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
