/** GraphQL queries, copied from docs/graphql-contract.md section 2. */

export const PAGE_BY_SLUG = `query PageBySlug($slug: ID!) {
  page(id: $slug, idType: URI) {
    databaseId slug title uri date modified content
    featuredImage { node { sourceUrl altText mediaDetails { width height } } }
  }
}`;

export const PAGES = `query Pages($first: Int = 20, $after: String) {
  pages(first: $first, after: $after, where: { orderby: { field: MENU_ORDER, order: ASC } }) {
    pageInfo { hasNextPage endCursor }
    nodes { databaseId slug title uri }
  }
}`;

/** Homepage carousel (docs/graphql-contract.md). Field names are case-sensitive and inconsistent; keep them exactly. */
export const HOMEPAGE_CAROUSELS = `query HomepageCarousels {
  homepageCarousels(first: 10) {
    nodes {
      databaseId title date
      carouselSmallToLarge {
        desktopLandscapeImage { node { sourceUrl altText mediaDetails { width height } } }
        desktopportraitImage  { node { sourceUrl altText mediaDetails { width height } } }
        tabletlandscapeimage  { node { sourceUrl altText mediaDetails { width height } } }
        tabletportraitimage   { node { sourceUrl altText mediaDetails { width height } } }
        mobileLandscapeImage  { node { sourceUrl altText mediaDetails { width height } } }
        mobileportraitimage   { node { sourceUrl altText mediaDetails { width height } } }
      }
    }
  }
}`;

/**
 * Events (custom post type). EVENT_FIELDS asks for the optional ACF group `eventDetails`; while that group
 * doesn't exist in WordPress the query fails with 'Cannot query field "eventDetails"', and the service retries
 * with EVENT_FIELDS_BASIC (no dates/location). See docs/events.md.
 */
const EVENT_FIELDS_BASIC = `databaseId slug title date content
      featuredImage { node { sourceUrl altText mediaDetails { width height } } }`;
const EVENT_FIELDS = EVENT_FIELDS_BASIC + `
      eventDetails { eventDate eventEndDate startTime location }`;

export const EVENTS = `query Events { events(first: 50, where: { status: PUBLISH }) { nodes { ${EVENT_FIELDS} } } }`;
export const EVENTS_BASIC = `query Events { events(first: 50, where: { status: PUBLISH }) { nodes { ${EVENT_FIELDS_BASIC} } } }`;
export const EVENT_BY_SLUG = `query EventBySlug($slug: ID!) { event(id: $slug, idType: SLUG) { ${EVENT_FIELDS} } }`;
export const EVENT_BY_SLUG_BASIC = `query EventBySlug($slug: ID!) { event(id: $slug, idType: SLUG) { ${EVENT_FIELDS_BASIC} } }`;

/** Blog posts (WordPress Posts), newest first. Author is not requested: user data is private to anonymous visitors. */
const POST_FIELDS = `databaseId slug title date excerpt
      featuredImage { node { sourceUrl altText mediaDetails { width height } } }
      categories { nodes { name } }`;
export const BLOG_POSTS = `query BlogPosts($first: Int!) {
  posts(first: $first, where: { status: PUBLISH, orderby: { field: DATE, order: DESC } }) { nodes { ${POST_FIELDS} } }
}`;
export const BLOG_POST_BY_SLUG = `query BlogPost($slug: ID!) { post(id: $slug, idType: SLUG) { ${POST_FIELDS} content } }`;
