import { Injectable, inject, DOCUMENT } from '@angular/core';
import { Meta, MetaDefinition, Title } from '@angular/platform-browser';
import { SITE, metaText, siteUrl } from './seo.config';

/** Everything a page tells search engines and social sites about itself. */
export interface PageSeo {
  /** Page title without the site suffix ("Events"). The home page passes the site name. */
  title: string;
  description?: string;
  /** Path on the public site ("/blog/my-post"). Becomes the canonical URL and og:url. Omit for error pages. */
  path?: string;
  image?: { url: string; alt?: string; width?: number; height?: number };
  /** og:type: 'article' for blog posts, 'website' for everything else. */
  type?: 'website' | 'article';
  /** ISO dates for articles. */
  publishedTime?: string;
  modifiedTime?: string;
  /** Keep the page out of search results (404, search results). */
  noindex?: boolean;
  /** schema.org structured data (JSON-LD) for this page. */
  jsonLd?: object | object[];
  /** Use the title as is, without " | 1-5-1 Incorporated" (home page). */
  bareTitle?: boolean;
}

/** Every tag apply() manages; they are replaced on each navigation so nothing is duplicated or left stale. */
export const MANAGED_META = [
  'name="description"', 'name="robots"',
  'property="og:title"', 'property="og:description"', 'property="og:type"', 'property="og:url"',
  'property="og:image"', 'property="og:image:alt"', 'property="og:image:width"', 'property="og:image:height"',
  'property="og:site_name"', 'property="og:locale"',
  'property="article:published_time"', 'property="article:modified_time"',
  'name="twitter:card"', 'name="twitter:title"', 'name="twitter:description"',
  'name="twitter:image"', 'name="twitter:image:alt"',
] as const;

const JSON_LD_ID = 'seo-jsonld';

/**
 * Page titles, descriptions, canonical links, robots, Open Graph / Twitter cards and JSON-LD.
 * One call per page: seo.apply({...}). Works in the browser and during server-side rendering (prerender).
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private meta = inject(Meta);
  private titleService = inject(Title);
  private document = inject(DOCUMENT);

  apply(page: PageSeo): void {
    const title = metaText(page.title, 120) || SITE.name;
    const fullTitle = page.bareTitle ? title : `${title} | ${SITE.titleSuffix}`;
    const description = metaText(page.description) || SITE.description;
    const url = page.path !== undefined ? siteUrl(page.path) : undefined;
    const image = page.image?.url ? page.image : SITE.defaultImage;
    const imageUrl = siteUrl(image.url);
    const imageAlt = metaText(image.alt || title, 200);

    this.titleService.setTitle(fullTitle);
    this.clear();

    const tags: MetaDefinition[] = [
      { name: 'description', content: description },
      { name: 'robots', content: page.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large' },
      { property: 'og:site_name', content: SITE.name },
      { property: 'og:locale', content: SITE.locale },
      { property: 'og:type', content: page.type ?? 'website' },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:image', content: imageUrl },
      { property: 'og:image:alt', content: imageAlt },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: imageUrl },
      { name: 'twitter:image:alt', content: imageAlt },
    ];
    if (url) { tags.push({ property: 'og:url', content: url }); }
    if (image.width && image.height) {
      tags.push({ property: 'og:image:width', content: String(image.width) });
      tags.push({ property: 'og:image:height', content: String(image.height) });
    }
    if (page.type === 'article') {
      if (page.publishedTime) { tags.push({ property: 'article:published_time', content: page.publishedTime }); }
      if (page.modifiedTime) { tags.push({ property: 'article:modified_time', content: page.modifiedTime }); }
    }
    this.meta.addTags(tags, true);

    this.setCanonical(page.noindex ? undefined : url);
    this.setJsonLd(page.jsonLd);
  }

  /** Remove every managed tag, the canonical link and the JSON-LD block. */
  clear(): void {
    for (const selector of MANAGED_META) {
      this.meta.getTags(selector).forEach(tag => this.meta.removeTagElement(tag));
    }
    this.setCanonical(undefined);
    this.setJsonLd(undefined);
  }

  private setCanonical(url: string | undefined): void {
    const head = this.document.head;
    head.querySelectorAll('link[rel="canonical"]').forEach(el => el.remove());
    if (!url) { return; }
    const link = this.document.createElement('link');
    link.setAttribute('rel', 'canonical');
    link.setAttribute('href', url);
    head.appendChild(link);
  }

  private setJsonLd(data: object | object[] | undefined): void {
    const head = this.document.head;
    head.querySelectorAll(`script#${JSON_LD_ID}`).forEach(el => el.remove());
    if (!data) { return; }
    const script = this.document.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.setAttribute('id', JSON_LD_ID);
    // "<" is escaped so content from WordPress can never close the script tag.
    script.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
    head.appendChild(script);
  }
}

/* ---------- schema.org helpers ---------- */

export function organizationLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': SITE.url + '/#organization',
    name: SITE.name,
    url: SITE.url + '/',
    logo: siteUrl(SITE.logo),
    email: SITE.email,
    foundingDate: '1982',
  };
}

export function websiteLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': SITE.url + '/#website',
    name: SITE.name,
    url: SITE.url + '/',
    publisher: { '@id': SITE.url + '/#organization' },
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem', position: i + 1, name: metaText(item.name, 120), item: siteUrl(item.path),
    })),
  };
}
