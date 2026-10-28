# GraphQL Contract — WordPress → Angular

- **Status:** DRAFT v0.1 (2026-10-28). Verified on **staging only**. Production still has the old names until the promotion step (see `wordpress-operations.md`).
- **Owner:** backend workstream. The Angular workstream reads this file and makes its changes in Claude Desktop.

## 1. Endpoint

| Environment | GraphQL endpoint | REST base (kept during migration) |
|---|---|---|
| Production | `https://tzin.brothersof1-5-1.org/graphql` | `https://tzin.brothersof1-5-1.org/wp-json/wp/v2/` |
| Staging | `https://tzin.brothersof1-5-1.org/staging/1848/graphql` | `https://tzin.brothersof1-5-1.org/staging/1848/wp-json/wp/v2/` |

- Use **POST** with `Content-Type: application/json` and the body `{ "query": "...", "variables": { ... } }`.
- Put the endpoint in Angular `environment.ts` / `environment.prod.ts`. Don't hard-code it.
- Fallback: `/index.php?graphql` works if `/graphql` ever returns a 404.

## 2. Public operations

### Page by slug (replaces `pages/{id}?_embed`)
```graphql
query PageBySlug($slug: ID!) {
  page(id: $slug, idType: URI) {
    databaseId slug title uri date modified content
    featuredImage { node { sourceUrl altText mediaDetails { width height } } }
  }
}
```
- Variables: `{ "slug": "membership" }`. Pages are top-level, so the slug equals the URI.
- Returns `page: null` when the slug doesn't exist. **Handle null with a 404 view.**
- Current slugs: `membership`, `president`, `about-1-5-1`, `moto`, `scholarship`, `foundation`.
- The homepage slug is **TBD** (the owner is rethinking the homepage). Don't use page ID 13.

### Page list (replaces `pages?_embed&filter[orderby]=menu_order`)
```graphql
query Pages($first: Int = 20, $after: String) {
  pages(first: $first, after: $after, where: { orderby: { field: MENU_ORDER, order: ASC } }) {
    pageInfo { hasNextPage endCursor }
    nodes { databaseId slug title uri }
  }
}
```

### Posts (replaces `posts?_embed&per_page=6` and `posts?search=`)
```graphql
query Posts($first: Int = 6, $after: String, $search: String) {
  posts(first: $first, after: $after, where: { search: $search }) {
    pageInfo { hasNextPage endCursor }
    nodes { databaseId slug title excerpt date
      featuredImage { node { sourceUrl altText } } }
  }
}
```
There are currently **0 published posts**, so expect an empty `nodes` array.

### Homepage carousel (new: replaces the static `assets/` images if wanted)
```graphql
query HomepageCarousels {
  homepageCarousels(first: 10) {
    nodes {
      databaseId title date
      carouselSmallToLarge {
        desktopLandscapeImage { node { sourceUrl altText } }
        desktopportraitImage  { node { sourceUrl altText } }
        tabletlandscapeimage  { node { sourceUrl altText } }
        tabletportraitimage   { node { sourceUrl altText } }
        mobileLandscapeImage  { node { sourceUrl altText } }
        mobileportraitimage   { node { sourceUrl altText } }
      }
    }
  }
}
```
- The field names are **case-sensitive and inconsistent** (`desktopportraitImage`, `mobileportraitimage`). Use them exactly as written.
- There are 3 items today.

### Events (new)
```graphql
query Events($first: Int = 10, $after: String) {
  events(first: $first, after: $after, where: { orderby: { field: DATE, order: DESC } }) {
    pageInfo { hasNextPage endCursor }
    nodes { databaseId slug title content
      eventGroup { startTime endTime paymentUrl eventImage { node { sourceUrl altText } } } }
  }
}
query EventBySlug($slug: ID!) { event(id: $slug, idType: SLUG) { title content eventGroup { startTime endTime paymentUrl } } }
```
- There are 0 events today.
- `startTime` and `endTime` are strings in the ACF field's return format. Confirm the format once a real event exists.

### Name changes vs production today

| Old (production now) | New (staging, after promotion) |
|---|---|
| `events` (single item) / `allEvents` (list) | `event` / `events` |
| `homepageCarousel` (single) / `allHomepageCarousel` (list) | `homepageCarousel` / `homepageCarousels` |

**Don't build against the old names.**

## 3. Pagination

- Cursor-based. Pass `first` (≤ 100) and `after: pageInfo.endCursor`, and stop when `hasNextPage` is false.
- There are no total counts (unlike REST's `X-WP-Total`). For "Load more", use `hasNextPage`.

## 4. Media URLs

- `sourceUrl` is an **absolute URL that includes the environment path**: staging URLs contain `/staging/1848/`. Use it as-is; never build media URLs by hand.
- Existing production media lives under `https://tzin.brothersof1-5-1.org/wp-content/uploads/...`. These URLs are preserved.
- `altText` may be an empty string. Fall back to the title.

## 5. Errors

- HTTP 200 with `{ "data": ..., "errors": [ { "message": "...", "locations": [...], "path": [...] } ] }` means the query was valid but a field failed, or there was a validation error.
- HTTP 500 with `errors` means a syntax error.
- Not found: the field returns `null` with no error.
- Query depth over 15 is rejected with an `errors` message.
- **Rule for Angular:** treat any `errors` array as a failure, log it, and show a friendly message. Treat `null` as not-found.

## 6. Authentication & privacy

- All operations above are **public and anonymous**. Send no `Authorization` header.
- Anonymous visitors **can't** see users, drafts, private content, settings emails, or schema introspection.
- CORS is allowed only from `https://brothersof1-5-1.org`, `https://www.brothersof1-5-1.org` and `http://localhost:4200`. There are no cookies or credentials.
- The member/login features are future work (see `security-architecture.md`). Hiding things in Angular is **not** security.

## 7. Differences from current REST responses

| REST | GraphQL |
|---|---|
| `title.rendered`, `content.rendered` | `title`, `content` (rendered HTML strings) |
| `id` | `databaseId` (int). `id` is a global opaque string |
| `_embedded['wp:featuredmedia'][0].source_url` | `featuredImage.node.sourceUrl` |
| `_embedded.author` | **Not available anonymously** (users are private) |
| `X-WP-Total` / `X-WP-TotalPages` headers | `pageInfo.hasNextPage` / `endCursor` |
| `filter[orderby]` (ignored by WP since 4.7) | `where: { orderby: { field, order } }` |
| Lookup by numeric ID | Lookup by slug/URI (recommended) |
