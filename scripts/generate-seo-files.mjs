#!/usr/bin/env node
/**
 * Writes sitemap.xml and robots.txt into the built site, from the live WordPress content.
 *
 *   node scripts/generate-seo-files.mjs                       # writes into dist/brotherof151/browser
 *   node scripts/generate-seo-files.mjs --out <dir>           # another output folder
 *   node scripts/generate-seo-files.mjs --graphql <url>       # another WordPress (default: environment.prod.ts)
 *
 * Runs automatically in scripts/package-site.sh after the build, so every deploy carries an up-to-date
 * sitemap listing every published page, blog post and event at its public address on brothersof1-5-1.org.
 * HostGator serves the site as static files, so the sitemap is refreshed on each deploy.
 *
 * Keep SITE_URL, the routes and RESERVED in step with src/app/Services/seo.config.ts and src/app/app.routes.ts.
 * If WordPress can't be reached the script stops with an error rather than shipping an incomplete sitemap.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SITE_URL = 'https://brothersof1-5-1.org';

/** Fixed routes of the Angular app that belong in search results. */
export const STATIC_ROUTES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/blog', changefreq: 'weekly', priority: '0.8' },
  { path: '/events', changefreq: 'weekly', priority: '0.8' },
];

/** Page slugs that can't be reached at /<slug> because a fixed route of the app uses that address. */
export const RESERVED = new Set(['blog', 'events', 'event', 'search', '404', 'pg', 'pst']);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function defaultGraphqlUrl() {
  const env = await readFile(join(ROOT, 'src/environments/environment.prod.ts'), 'utf8');
  const m = /graphqlUrl:\s*'([^']+)'/.exec(env);
  if (!m) { throw new Error('graphqlUrl not found in src/environments/environment.prod.ts'); }
  return m[1];
}

async function gql(url, query, variables = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) { throw new Error(`GraphQL HTTP ${res.status} from ${url}`); }
  const body = await res.json();
  if (body.errors?.length) { throw new Error('GraphQL error: ' + body.errors.map(e => e.message).join('; ')); }
  return body.data;
}

/** All published nodes of one type, following pagination. */
async function all(url, field, extraWhere = '') {
  const nodes = [];
  let after = null;
  for (let page = 0; page < 50; page++) {
    const query = `query All($after: String) {
      ${field}(first: 100, after: $after, where: { status: PUBLISH ${extraWhere} }) {
        pageInfo { hasNextPage endCursor }
        nodes { slug modifiedGmt }
      }
    }`;
    const data = await gql(url, query, { after });
    nodes.push(...data[field].nodes);
    if (!data[field].pageInfo.hasNextPage) { return nodes; }
    after = data[field].pageInfo.endCursor;
  }
  return nodes;
}

const xmlEscape = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** WordPress modifiedGmt ("2026-11-01T13:05:22") → W3C date ("2026-11-01"). */
export function lastmod(modifiedGmt) {
  return /^\d{4}-\d{2}-\d{2}/.test(modifiedGmt ?? '') ? modifiedGmt.slice(0, 10) : undefined;
}

/** Build the list of sitemap entries from WordPress content. */
export function entries({ pages = [], posts = [], events = [] }) {
  const out = [...STATIC_ROUTES];
  const newest = list => list.map(n => lastmod(n.modifiedGmt)).filter(Boolean).sort().pop();
  const blog = out.find(e => e.path === '/blog'); blog.lastmod = newest(posts);
  const ev = out.find(e => e.path === '/events'); ev.lastmod = newest(events);
  for (const p of pages) {
    if (!p.slug || RESERVED.has(p.slug)) { continue; }
    out.push({ path: '/' + p.slug, lastmod: lastmod(p.modifiedGmt), changefreq: 'monthly', priority: '0.7' });
  }
  for (const p of posts) {
    if (p.slug) { out.push({ path: '/blog/' + p.slug, lastmod: lastmod(p.modifiedGmt), changefreq: 'monthly', priority: '0.6' }); }
  }
  for (const e of events) {
    if (e.slug) { out.push({ path: '/event/' + e.slug, lastmod: lastmod(e.modifiedGmt), changefreq: 'weekly', priority: '0.6' }); }
  }
  const seen = new Set();
  return out.filter(e => !seen.has(e.path) && seen.add(e.path));
}

export function sitemapXml(list) {
  const urls = list.map(e => [
    '  <url>',
    `    <loc>${xmlEscape(SITE_URL + (e.path === '/' ? '/' : encodeURI(e.path)))}</loc>`,
    e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
    e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
    e.priority ? `    <priority>${e.priority}</priority>` : null,
    '  </url>',
  ].filter(Boolean).join('\n'));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

export function robotsTxt() {
  return [
    '# The Brothers of 1-5-1, Incorporated',
    'User-agent: *',
    'Allow: /',
    '# Search results pages are for visitors, not search engines.',
    'Disallow: /search/',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n');
}

async function main() {
  const out = resolve(arg('--out', join(ROOT, 'dist/brotherof151/browser')));
  const url = arg('--graphql', await defaultGraphqlUrl());

  console.log(`Reading published pages, posts and events from ${url}`);
  const [pages, posts, events] = await Promise.all([
    all(url, 'pages'),
    all(url, 'posts'),
    all(url, 'events'),
  ]);
  const list = entries({ pages, posts, events });

  await mkdir(out, { recursive: true });
  await writeFile(join(out, 'sitemap.xml'), sitemapXml(list));
  await writeFile(join(out, 'robots.txt'), robotsTxt());
  console.log(`sitemap.xml: ${list.length} addresses (${pages.length} pages, ${posts.length} posts, ${events.length} events)`);
  console.log(`robots.txt and sitemap.xml written to ${out}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('\nERROR: could not build the sitemap: ' + err.message);
    console.error('Nothing was written. Check that WordPress is up, then run the script again.');
    process.exit(1);
  });
}
