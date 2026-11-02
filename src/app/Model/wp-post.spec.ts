import { formatPostDate, postFromGraphql } from './wp-post';

describe('wp-post', () => {
  it('maps a GraphQL post (title/excerpt as HTML, categories without "Uncategorized")', () => {
    const p = postFromGraphql({
      databaseId: 175, slug: 'a-new-chapter', title: 'A New Chapter &#8211; Welcome', date: '2026-11-02T05:14:13',
      excerpt: '<p>Our website has undergone a significant transformation [&hellip;]</p>\n',
      featuredImage: { node: { sourceUrl: 'https://img.test/p.jpg', altText: null, mediaDetails: { width: 819, height: 1024 } } },
      categories: { nodes: [{ name: 'blog' }, { name: 'Uncategorized' }] },
    });
    expect(p).toEqual(jasmine.objectContaining({ id: 175, slug: 'a-new-chapter', title: 'A New Chapter &#8211; Welcome', categories: ['blog'] }));
    expect(p.excerptText).toBe('Our website has undergone a significant transformation…');
    expect(p.image).toEqual({ url: 'https://img.test/p.jpg', alt: '', width: 819, height: 1024 });
    expect(p.contentHtml).toBeUndefined();
  });

  it('formats the publish date without shifting the day', () => {
    expect(formatPostDate('2026-11-02T05:14:13')).toBe('November 2, 2026');
    expect(formatPostDate('')).toBe('');
  });
});
