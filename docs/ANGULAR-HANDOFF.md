# Angular Handoff — Read This First (for Claude Desktop)

**From:** WordPress backend workstream (Claude Cowork) · **Date:** 2026-10-28
**Repo:** `151Incorporated` · **Rule:** the backend workstream doesn't edit Angular code. All Angular changes happen in Claude Desktop, guided by this file.

## TL;DR

1. WordPress is ready. **REST keeps working** while you migrate, so nothing breaks today.
2. GraphQL is ready on **staging**: `https://tzin.brothersof1-5-1.org/staging/1848/graphql`.
3. The full query reference is in **`docs/graphql-contract.md`**. Copy the queries from there exactly.
4. **Stop using page ID 13** for the homepage. It doesn't exist. Kenneth is choosing a new homepage slug.

## What changed in the backend (2026-10-28, staging only)

| Change | Why it matters to Angular |
|---|---|
| GraphQL names fixed: `event` / `events`, `homepageCarousel` / `homepageCarousels` | Use **only** these names. Production still shows the old names (`allEvents`, `allHomepageCarousel`) until promotion, so don't code against them |
| Users are hidden from anonymous requests (REST `/wp/v2/users` is 404, GraphQL `users` is `[]`) | Don't display post authors. `_embed` author data will be missing |
| CORS allow-list: `https://brothersof1-5-1.org`, `https://www.brothersof1-5-1.org`, `http://localhost:4200` | Local dev must run on port **4200**. Other origins are blocked |
| GraphQL query depth limited to 15 | Keep queries shallow (everything in the contract is well under the limit) |
| No auth is needed for public content | Send no `Authorization` header and no cookies (`withCredentials: false`) |

## Angular tasks (suggested order)

1. **Environment config:** add `graphqlUrl` and `restUrl` to `environment.ts` (staging) and `environment.prod.ts` (production: `https://tzin.brothersof1-5-1.org/graphql`). Remove the hard-coded `https://tzin.brothersof1-5-1.org/wp-json/wp/v2/` string from the services.
2. **Homepage fix:** load the homepage **by slug**, not by ID. Make the slug a config value until Kenneth decides on it.
3. **Page route `pg/:id/:title`:**
   - Switch to slug-based lookup: `page(id: $slug, idType: URI)`.
   - Handle `page: null` with a 404 view.
   - Consider changing the route to `pg/:slug`, and keep the old route as a redirect.
4. **GraphQL client:** either Apollo Angular, or a thin `HttpClient.post(graphqlUrl, { query, variables })` service. Treat any `errors[]` as a failure.
5. **Carousel:** optionally replace the static `assets/` carousel images with `homepageCarousels`. Use `<picture>` with the six responsive image fields. The field names are case-sensitive and inconsistent (see the contract).
6. **Events:** the "News & Upcoming Events" box currently shows "Hello world!". Wire it to the `events` query, with a friendly empty state (0 events today).
7. **Posts and search:** use the `posts` query with `where: { search }`. There are 0 posts today, so build the empty states.
8. **Media:** always use `sourceUrl` exactly as returned. Staging URLs include `/staging/1848/`.

## Field mapping (REST → GraphQL)

- `title.rendered` → `title`
- `content.rendered` → `content`
- `id` → `databaseId`
- `_embedded['wp:featuredmedia'][0].source_url` → `featuredImage.node.sourceUrl`
- `X-WP-Total` → `pageInfo.hasNextPage` / `endCursor`

## Don'ts

- Don't call the production GraphQL endpoint until Kenneth confirms promotion. The names differ until then.
- Don't remove the REST code paths until the GraphQL versions are verified.
- Don't put secrets, tokens or member data in Angular. Future member features will be authorized on the server (see `docs/security-architecture.md`).

## When Angular changes are done

Append an entry to `docs/change-log.md` with: date, branch, files changed, what was tested, open issues. Then tell the backend workstream so it can promote the staging changes to production.

## Related docs

- `docs/graphql-contract.md`: queries, variables, response shapes, errors
- `docs/project-status.md`: phase status and open decisions
- `docs/wordpress-operations.md`: environments, backups, staging, promotion checklist
- `docs/security-architecture.md`: current hardening and the member-portal plan
- `docs/backend-audit.md`: original audit
- `docs/change-log.md`: history of all backend changes
- `wordpress/mu-plugins/bo151-api-hardening.php`: the backend hardening code (deployed to staging)
