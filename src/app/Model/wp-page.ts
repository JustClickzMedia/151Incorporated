/**
 * One WordPress page, the same shape whether it came from REST or GraphQL.
 * Components use this instead of the raw REST shape (title.rendered, _embedded, ...), so the data
 * source can switch without touching templates. See docs/graphql-contract.md section 7.
 */
export interface WpPage {
  id: number;
  slug: string;
  /** Rendered title HTML string from WordPress (may contain entities such as &#8211;). */
  title: string;
  contentHtml: string;
  /** Short HTML summary. REST provides one; for GraphQL it is built from the content (Page has no excerpt field). */
  excerptHtml: string;
  /** The excerpt as plain text, for meta descriptions. */
  excerptText: string;
  date: string;
  featuredImage?: { url: string; alt: string };
}

/** Minimal page info for menus. */
export interface WpPageLink {
  id: number;
  slug: string;
  title: string;
}

/** Number of words WordPress uses for automatic excerpts. */
const EXCERPT_WORDS = 55;

/** Tags that separate words (block-level); other tags (b, a, span, ...) are removed without adding a space. */
const BLOCK_TAG = /<\/?(p|div|br|hr|li|ul|ol|h[1-6]|blockquote|section|article|figure|figcaption|table|tr|td|th)\b[^>]*>/gi;

/** HTML -> plain text without a DOM (works during SSR). Entities are left as-is. */
export function htmlToText(html: string): string {
  return (html ?? '').replace(BLOCK_TAG, ' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/** WordPress-style automatic excerpt: first 55 words of the text, then " [&hellip;]". */
export function excerptFromContent(contentHtml: string, words = EXCERPT_WORDS): string {
  const all = htmlToText(contentHtml).split(' ').filter(Boolean);
  if (all.length === 0) { return ''; }
  const text = all.slice(0, words).join(' ');
  return '<p>' + text + (all.length > words ? ' [&hellip;]' : '') + '</p>';
}

/** Map a REST /wp/v2/pages item (with _embed) to WpPage. */
export function pageFromRest(p: any): WpPage {
  const media = p?._embedded?.['wp:featuredmedia']?.[0];
  const url: string | undefined = media?.media_details?.sizes?.full?.source_url ?? media?.source_url;
  const excerptHtml: string = p?.excerpt?.rendered ?? excerptFromContent(p?.content?.rendered ?? '');
  return {
    id: p?.id,
    slug: p?.slug ?? '',
    title: p?.title?.rendered ?? '',
    contentHtml: p?.content?.rendered ?? '',
    excerptHtml,
    excerptText: htmlToText(excerptHtml),
    date: p?.date ?? '',
    featuredImage: url ? { url, alt: media?.alt_text ?? '' } : undefined,
  };
}

/** GraphQL Page fields requested by PAGE_BY_SLUG. */
export interface GqlPage {
  databaseId: number;
  slug: string;
  title: string | null;
  date: string | null;
  content: string | null;
  featuredImage: { node: { sourceUrl: string | null; altText: string | null } | null } | null;
}

/** Map a GraphQL Page (PAGE_BY_SLUG) to WpPage. */
export function pageFromGraphql(p: GqlPage): WpPage {
  const content = p.content ?? '';
  const excerptHtml = excerptFromContent(content);
  const node = p.featuredImage?.node;
  return {
    id: p.databaseId,
    slug: p.slug ?? '',
    title: p.title ?? '',
    contentHtml: content,
    excerptHtml,
    excerptText: htmlToText(excerptHtml),
    date: p.date ?? '',
    // Use sourceUrl exactly as returned (staging URLs include /staging/1848/).
    featuredImage: node?.sourceUrl ? { url: node.sourceUrl, alt: node.altText ?? '' } : undefined,
  };
}
