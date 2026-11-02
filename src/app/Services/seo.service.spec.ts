import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

import { MANAGED_META, SeoService, breadcrumbLd, organizationLd } from './seo.service';
import { SITE, metaText, siteUrl } from './seo.config';

describe('SeoService', () => {
  let seo: SeoService;
  let meta: Meta;
  let doc: Document;
  const content = (sel: string) => meta.getTag(sel)?.content;
  const canonical = () => doc.head.querySelectorAll('link[rel="canonical"]');
  const jsonLd = () => doc.head.querySelectorAll('script[type="application/ld+json"]');

  beforeEach(() => {
    TestBed.configureTestingModule({});
    seo = TestBed.inject(SeoService);
    meta = TestBed.inject(Meta);
    doc = TestBed.inject(DOCUMENT);
    seo.clear();
  });

  afterEach(() => seo.clear());

  it('sets title, description, canonical link and social tags for a page', () => {
    seo.apply({ title: 'Membership', description: '<p>Join the brotherhood &amp; more</p>', path: '/membership' });
    expect(TestBed.inject(Title).getTitle()).toBe('Membership | 1-5-1 Incorporated');
    expect(content('name="description"')).toBe('Join the brotherhood & more');
    expect(content('name="robots"')).toContain('index, follow');
    expect(content('property="og:title"')).toBe('Membership');
    expect(content('property="og:url"')).toBe('https://brothersof1-5-1.org/membership');
    expect(content('property="og:image"')).toBe('https://brothersof1-5-1.org/assets/images/og-default.png');
    expect(content('name="twitter:card"')).toBe('summary_large_image');
    expect(canonical().length).toBe(1);
    expect(canonical()[0].getAttribute('href')).toBe('https://brothersof1-5-1.org/membership');
  });

  it('never duplicates tags across navigations, and drops tags the new page does not use', () => {
    seo.apply({ title: 'Post', path: '/blog/a', type: 'article', publishedTime: '2026-11-02T09:00:00', jsonLd: organizationLd() });
    seo.apply({ title: 'Events', path: '/events' });
    for (const sel of MANAGED_META) {
      expect(meta.getTags(sel).length).withContext(sel).toBeLessThanOrEqual(1);
    }
    expect(meta.getTag('property="article:published_time"')).toBeNull();
    expect(canonical().length).toBe(1);
    expect(jsonLd().length).toBe(0);
  });

  it('replaces the defaults that index.html ships for crawlers', () => {
    meta.addTag({ name: 'description', content: 'static default' }, true);
    seo.apply({ title: 'Blog', path: '/blog' });
    expect(meta.getTags('name="description"').length).toBe(1);
    expect(content('name="description"')).not.toBe('static default');
  });

  it('uses the page image when there is one', () => {
    seo.apply({ title: 'Event', path: '/event/x', image: { url: 'https://tzin.brothersof1-5-1.org/wp-content/uploads/flyer.jpg', alt: 'Flyer', width: 1024, height: 409 } });
    expect(content('property="og:image"')).toBe('https://tzin.brothersof1-5-1.org/wp-content/uploads/flyer.jpg');
    expect(content('property="og:image:width"')).toBe('1024');
    expect(content('property="og:image:alt"')).toBe('Flyer');
  });

  it('keeps error and search pages out of search results, without a canonical link', () => {
    seo.apply({ title: 'Page not found', noindex: true });
    expect(content('name="robots"')).toBe('noindex, follow');
    expect(canonical().length).toBe(0);
  });

  it('home page uses the bare title', () => {
    seo.apply({ title: SITE.titleSuffix, bareTitle: true, path: '/' });
    expect(TestBed.inject(Title).getTitle()).toBe('1-5-1 Incorporated');
    expect(canonical()[0].getAttribute('href')).toBe('https://brothersof1-5-1.org/');
  });

  it('writes JSON-LD that cannot break out of its script tag', () => {
    seo.apply({ title: 'x', path: '/x', jsonLd: [{ '@type': 'Thing', name: '</script><script>alert(1)</script>' }] });
    const scripts = jsonLd();
    expect(scripts.length).toBe(1);
    expect(scripts[0].textContent).not.toContain('</script>');
    expect(JSON.parse(scripts[0].textContent!)[0].name).toBe('</script><script>alert(1)</script>');
  });

  it('builds breadcrumbs with absolute addresses', () => {
    const ld: any = breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Blog', path: '/blog' }]);
    expect(ld.itemListElement[1]).toEqual({ '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://brothersof1-5-1.org/blog' });
  });
});

describe('seo.config helpers', () => {
  it('siteUrl() makes clean absolute addresses on the public site', () => {
    expect(siteUrl('/')).toBe('https://brothersof1-5-1.org/');
    expect(siteUrl('blog/')).toBe('https://brothersof1-5-1.org/blog');
    expect(siteUrl('/events?x=1#y')).toBe('https://brothersof1-5-1.org/events');
    expect(siteUrl('https://cdn.example/x.jpg')).toBe('https://cdn.example/x.jpg');
  });

  it('metaText() strips HTML, decodes entities and shortens at a word', () => {
    expect(metaText('<p>Brothers&#8217; night &amp; more [&hellip;]</p>')).toBe('Brothers’ night & more …');
    const long = metaText(Array(80).fill('word').join(' '));
    expect(long.length).toBeLessThanOrEqual(160);
    expect(long.endsWith('…')).toBeTrue();
    expect(metaText(undefined)).toBe('');
  });
});
