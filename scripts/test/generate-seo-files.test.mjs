// node --test scripts/test  — checks the sitemap/robots generator against a fake WordPress GraphQL server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { entries, sitemapXml, robotsTxt, lastmod } from '../generate-seo-files.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'generate-seo-files.mjs');

// Shapes as returned by production WordPress on 2026-11-02.
const DATA = {
  pages: [{ slug: 'membership', modifiedGmt: '2024-04-04T10:00:00' }, { slug: 'about-1-5-1', modifiedGmt: '2024-04-24T10:00:00' }, { slug: 'blog', modifiedGmt: '2024-01-01T00:00:00' }],
  posts: [{ slug: 'a-new-chapter', modifiedGmt: '2026-11-02T09:00:00' }],
  events: [{ slug: 'got-skillz-6', modifiedGmt: '2026-11-01T13:05:22' }],
};

function fakeWordPress({ fail = false } = {}) {
  return new Promise(res => {
    const server = createServer((req, reply) => {
      let body = '';
      req.on('data', c => body += c).on('end', () => {
        if (fail) { reply.writeHead(500); return reply.end('down'); }
        const { query } = JSON.parse(body);
        const field = ['pages', 'posts', 'events'].find(f => query.includes(`${f}(first`));
        reply.writeHead(200, { 'Content-Type': 'application/json' });
        reply.end(JSON.stringify({ data: { [field]: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: DATA[field] } } }));
      });
    }).listen(0, () => res(server));
  });
}

const run = (args) => new Promise(res => execFile(process.execPath, [SCRIPT, ...args], (err, stdout, stderr) => res({ code: err ? err.code : 0, stdout, stderr })));

test('lists every public address once, at brothersof1-5-1.org', () => {
  const list = entries(DATA);
  const paths = list.map(e => e.path);
  assert.deepEqual(paths, ['/', '/blog', '/events', '/membership', '/about-1-5-1', '/blog/a-new-chapter', '/event/got-skillz-6']);
  assert.ok(!paths.includes('/blog') || paths.filter(p => p === '/blog').length === 1, 'a WordPress page named "blog" does not duplicate the Blog route');
  assert.equal(list.find(e => e.path === '/blog').lastmod, '2026-11-02');
  const xml = sitemapXml(list);
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<loc>https:\/\/brothersof1-5-1\.org\/event\/got-skillz-6<\/loc>/);
  assert.doesNotMatch(xml, /tzin\./);
  assert.equal((xml.match(/<url>/g) || []).length, 7);
});

test('escapes XML and formats dates', () => {
  const xml = sitemapXml([{ path: '/a&b', lastmod: lastmod('2026-01-02T03:04:05') }]);
  assert.match(xml, /<loc>https:\/\/brothersof1-5-1\.org\/a&amp;b<\/loc>/);
  assert.match(xml, /<lastmod>2026-01-02<\/lastmod>/);
  assert.equal(lastmod(null), undefined);
});

test('robots.txt allows crawling and points at the sitemap', () => {
  const r = robotsTxt();
  assert.match(r, /User-agent: \*/);
  assert.match(r, /Disallow: \/search\//);
  assert.doesNotMatch(r, /Disallow: \/\s*$/m);
  assert.match(r, /Sitemap: https:\/\/brothersof1-5-1\.org\/sitemap\.xml/);
});

test('writes both files from a WordPress GraphQL endpoint', async () => {
  const server = await fakeWordPress();
  const out = await mkdtemp(join(tmpdir(), 'seo-'));
  const r = await run(['--out', out, '--graphql', `http://127.0.0.1:${server.address().port}/graphql`]);
  server.close();
  assert.equal(r.code, 0, r.stderr);
  assert.match(await readFile(join(out, 'sitemap.xml'), 'utf8'), /got-skillz-6/);
  assert.match(await readFile(join(out, 'robots.txt'), 'utf8'), /Sitemap:/);
});

test('stops with an error, and writes nothing, when WordPress is down', async () => {
  const server = await fakeWordPress({ fail: true });
  const out = await mkdtemp(join(tmpdir(), 'seo-'));
  const r = await run(['--out', out, '--graphql', `http://127.0.0.1:${server.address().port}/graphql`]);
  server.close();
  assert.notEqual(r.code, 0);
  await assert.rejects(readFile(join(out, 'sitemap.xml')));
});
