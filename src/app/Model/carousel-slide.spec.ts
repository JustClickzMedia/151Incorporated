import { slideFromGraphql, GqlHomepageCarousel } from './carousel-slide';

const node = (url: string | null, alt: string | null = '') => ({ node: { sourceUrl: url, altText: alt, mediaDetails: { width: 10, height: 5 } } });

describe('slideFromGraphql', () => {
  const base = (images: Partial<NonNullable<GqlHomepageCarousel['carouselSmallToLarge']>>): GqlHomepageCarousel => ({
    databaseId: 1, title: 'Title',
    carouselSmallToLarge: { desktopLandscapeImage: null, desktopportraitImage: null, tabletlandscapeimage: null,
      tabletportraitimage: null, mobileLandscapeImage: null, mobileportraitimage: null, ...images },
  });

  it('uses altText when WordPress has one', () => {
    expect(slideFromGraphql(base({ desktopLandscapeImage: node('https://x/a.jpg', 'Hotel') }))!.alt).toBe('Hotel');
  });

  it('skips missing sizes and uses the next image as the <img> when desktop landscape is missing', () => {
    const s = slideFromGraphql(base({ desktopportraitImage: node('https://x/dp.jpg'), mobileportraitimage: node('https://x/mp.jpg') }))!;
    expect(s.src).toBe('https://x/dp.jpg');
    expect(s.sources.map(x => x.srcset)).toEqual(['https://x/mp.jpg']);
  });

  it('returns undefined for an item with no images', () => {
    expect(slideFromGraphql(base({}))).toBeUndefined();
    expect(slideFromGraphql({ databaseId: 2, title: null, carouselSmallToLarge: null })).toBeUndefined();
    expect(slideFromGraphql(base({ desktopLandscapeImage: node(null) }))).toBeUndefined();
  });
});
