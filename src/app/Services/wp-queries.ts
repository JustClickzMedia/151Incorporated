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
