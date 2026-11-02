import { htmlToText } from './wp-page';

/** One blog post (WordPress Post), from GraphQL. */
export interface WpPost {
  id: number;
  slug: string;
  /** Rendered title; may contain HTML entities (&#8217;), so templates bind it with [innerHTML]. */
  title: string;
  /** WordPress excerpt (rendered HTML, e.g. "<p>… [&hellip;]</p>"). */
  excerptHtml: string;
  /** The excerpt as plain text (for meta descriptions). */
  excerptText: string;
  /** Full content; only loaded on the post's own page. */
  contentHtml?: string;
  /** Publish date as WordPress gives it (site time, ISO without zone). */
  date: string;
  categories: string[];
  image?: { url: string; alt: string; width?: number; height?: number };
}

interface GqlImage { node: { sourceUrl: string | null; altText: string | null; mediaDetails?: { width: number | null; height: number | null } | null } | null }

export interface GqlPost {
  databaseId: number;
  slug: string;
  title: string | null;
  date: string | null;
  excerpt: string | null;
  content?: string | null;
  featuredImage: GqlImage | null;
  categories?: { nodes: { name: string | null }[] } | null;
}

export function postFromGraphql(p: GqlPost): WpPost {
  const img = p.featuredImage?.node;
  const excerptHtml = p.excerpt ?? '';
  return {
    id: p.databaseId,
    slug: p.slug,
    title: p.title ?? '',
    excerptHtml,
    excerptText: htmlToText(excerptHtml).replace(/\s*\[&hellip;\]\s*$/, '…'),
    contentHtml: p.content ?? undefined,
    date: p.date ?? '',
    categories: (p.categories?.nodes ?? []).map(c => c.name ?? '').filter(n => n && n.toLowerCase() !== 'uncategorized'),
    image: img?.sourceUrl
      ? { url: img.sourceUrl, alt: img.altText || '', width: img.mediaDetails?.width ?? undefined, height: img.mediaDetails?.height ?? undefined }
      : undefined,
  };
}

/** "November 2, 2026" (the date as published, no time-zone shift). */
export function formatPostDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? '');
  if (!m) { return ''; }
  return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
