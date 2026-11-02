/**
 * Site-wide SEO facts. Used by SeoService (meta tags in the browser) and mirrored in
 * scripts/generate-seo-files.mjs (sitemap.xml and robots.txt at build time) — keep the two in step.
 */
export const SITE = {
  /** Public address of the site: canonical links, sitemap and social previews always use it. */
  url: 'https://brothersof1-5-1.org',
  name: 'The Brothers of 1-5-1, Incorporated',
  /** Appended to page titles: "Events | 1-5-1 Incorporated". */
  titleSuffix: '1-5-1 Incorporated',
  description:
    'The Brothers of 1-5-1, Incorporated: our brotherhood, history, chapters, events and news.',
  email: 'info@brothersof1-5-1.org',
  logo: '/assets/icons/icon-512.png',
  /** 1200×630 picture shown when a page without its own image is shared (Facebook, iMessage, LinkedIn…). */
  defaultImage: {
    url: '/assets/images/og-default.png',
    width: 1200,
    height: 630,
    alt: 'The Brothers of 1-5-1, Incorporated shield',
  },
  locale: 'en_US',
} as const;

/** Absolute URL on the public site for a path ("/blog" → "https://brothersof1-5-1.org/blog"). */
export function siteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) { return path; }
  const clean = ('/' + (path ?? '').replace(/^\/+/, '')).replace(/[?#].*$/, '');
  return SITE.url + (clean === '/' ? '/' : clean.replace(/\/+$/, ''));
}

/** Plain text for meta tags: no HTML, entities decoded, whitespace collapsed, cut at a word boundary. */
export function metaText(input: string | undefined | null, max = 160): string {
  const text = (input ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&#8217;|&rsquo;/g, '’').replace(/&#8216;|&lsquo;/g, '‘')
    .replace(/&#8220;|&ldquo;/g, '“').replace(/&#8221;|&rdquo;/g, '”')
    .replace(/&#8211;|&ndash;/g, '–').replace(/&#8212;|&mdash;/g, '—')
    .replace(/&hellip;|&#8230;/g, '…').replace(/\[…\]/g, '…')
    .replace(/&quot;/g, '"').replace(/&#039;|&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) { return text; }
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–—-]+$/, '') + '…';
}
