# Project Status — WordPress Backend Modernization

**Last updated:** 2026-10-26
**Current phase:** Phase 1 (Discovery) is complete and **waiting for review**.

| Phase | Status |
|---|---|
| 1. Discovery & audit | Done. See `backend-audit.md` |
| 2. Backup & staging | Blocked. Needs cPanel access, and there's no confirmed backup |
| 3. GraphQL implementation (staging) | Not started. WPGraphQL is already installed on production |
| 4. Members portal planning | Not started |
| 5. Frontend handoff (`graphql-contract.md`) | Not started. Waits on the staging schema |
| 6. Documentation | In progress |

## Critical items

1. ~~Production REST unreachable~~: transient and resolved on its own. Verified healthy; no change made.
2. **The Angular home page requests page ID 13, which doesn't exist, so the homepage body fails to load (404).**
3. A weekly HostGator backup exists (last run 2026-10-26).

## Decisions needed from Kenneth

- Approve a production fix for the `/wp-json/` rewrite issue, after a backup.
- Choose how to fix the missing page 13.
- Provide the staging approach and cPanel backup access.
- Provide repo access so these docs can be committed on a dedicated branch.
- Give the list of approved CORS origins.
