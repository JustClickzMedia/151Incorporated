/**
 * One homepage carousel slide from the WordPress "Homepage Carousel" type (GraphQL homepageCarousels).
 * Each slide has up to six images for different screens; the template turns them into a <picture>.
 */
export interface CarouselSlide {
  id: number;
  title: string;
  /** altText of the main image, or the slide title when WordPress has no alt text. */
  alt: string;
  /** Fallback <img> src: the desktop landscape image, or the first image that exists. */
  src: string;
  width?: number;
  height?: number;
  /** <source> entries, most specific media query first. Missing images are left out. */
  sources: { media: string; srcset: string }[];
}

interface GqlImage { node: { sourceUrl: string | null; altText: string | null; mediaDetails?: { width: number | null; height: number | null } | null } | null }

/** GraphQL HomepageCarousel fields requested by HOMEPAGE_CAROUSELS. Field names are case-sensitive and inconsistent. */
export interface GqlHomepageCarousel {
  databaseId: number;
  title: string | null;
  carouselSmallToLarge: {
    desktopLandscapeImage: GqlImage | null;
    desktopportraitImage: GqlImage | null;
    tabletlandscapeimage: GqlImage | null;
    tabletportraitimage: GqlImage | null;
    mobileLandscapeImage: GqlImage | null;
    mobileportraitimage: GqlImage | null;
  } | null;
}

/**
 * Which image is used on which screen. The browser picks the first <source> whose media query matches,
 * so the most specific queries come first; anything wider falls through to the desktop landscape <img>.
 */
export const CAROUSEL_BREAKPOINTS = [
  { field: 'mobileportraitimage', media: '(max-width: 480px) and (orientation: portrait)' },
  { field: 'mobileLandscapeImage', media: '(max-height: 480px) and (orientation: landscape)' },
  { field: 'tabletportraitimage', media: '(max-width: 1024px) and (orientation: portrait)' },
  { field: 'tabletlandscapeimage', media: '(max-width: 1280px) and (orientation: landscape)' },
  { field: 'desktopportraitImage', media: '(max-width: 1440px)' },
] as const;

/** Order used to pick the fallback <img> when the desktop landscape image is missing. */
const FALLBACK_ORDER = ['desktopLandscapeImage', 'desktopportraitImage', 'tabletlandscapeimage',
  'tabletportraitimage', 'mobileLandscapeImage', 'mobileportraitimage'] as const;

/** Map a GraphQL carousel item to a slide. Returns undefined when it has no images at all. */
export function slideFromGraphql(item: GqlHomepageCarousel): CarouselSlide | undefined {
  const images = item.carouselSmallToLarge;
  if (!images) { return undefined; }
  const node = (field: keyof NonNullable<GqlHomepageCarousel['carouselSmallToLarge']>) =>
    images[field]?.node?.sourceUrl ? images[field]!.node! : undefined;

  const mainField = FALLBACK_ORDER.find(f => node(f));
  if (!mainField) { return undefined; }
  const main = node(mainField)!;
  const title = item.title ?? '';

  return {
    id: item.databaseId,
    title,
    alt: main.altText || title,
    // Use sourceUrl exactly as returned (staging URLs include /staging/1848/).
    src: main.sourceUrl!,
    width: main.mediaDetails?.width ?? undefined,
    height: main.mediaDetails?.height ?? undefined,
    sources: CAROUSEL_BREAKPOINTS
      .filter(b => b.field !== mainField && node(b.field))
      .map(b => ({ media: b.media, srcset: node(b.field)!.sourceUrl! })),
  };
}
