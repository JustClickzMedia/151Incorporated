# Project Status — WordPress Backend Modernization

**Last updated:** 2026-10-28

| Phase | Status |
|---|---|
| 1. Discovery & audit | Done |
| 2. Backup & staging | Done. Weekly HostGator backup is active; staging is at `/staging/1848`. The restore procedure hasn't been tested yet |
| 3. GraphQL implementation | **Done on staging.** Production promotion is waiting for approval |
| 4. Members portal planning | Drafted in `security-architecture.md` |
| 5. Frontend handoff | `ANGULAR-HANDOFF.md` and `graphql-contract.md` v0.1 are ready for Angular |
| 6. Documentation | Up to date |

## Ready for Angular

- **REST:** works today in production and stays on during the migration.
- **GraphQL:** Angular can build against the **staging** endpoint using the new names (`events`, `homepageCarousels`).

## Decisions needed from Kenneth

1. The homepage page or slug (you're rethinking this).
2. Approval to promote the staging changes to production (checklist in `wordpress-operations.md`).
3. Whether to keep `http://localhost:4200` in the production CORS list.
4. Whether to turn off GraphQL batching, and whether to add WPGraphQL Smart Cache.
