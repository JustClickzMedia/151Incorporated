# SEO

| Piece | Where | Updates |
|---|---|---|
| Title, description, canonical link, robots, Open Graph / Twitter cards, JSON-LD | `SeoService.apply()` (src/app/Services/seo.service.ts), called by every page component | Every navigation; the home page and /404 are also prerendered into static HTML |
| Defaults for crawlers that don't run JavaScript (Facebook, iMessage, LinkedIn previews) | `src/index.html` | Each deploy |
| Share image 1200×630, 512 icon, web manifest | `src/assets/images/og-default.png`, `src/assets/icons/icon-512.png`, `src/site.webmanifest` | — |
| `sitemap.xml`, `robots.txt` | `scripts/generate-seo-files.mjs`, run by `scripts/package-site.sh` after the build | Each deploy (reads every published page, post and event from WordPress) |

Structured data: Organization + WebSite (home), BlogPosting (blog posts), Event (events with a date **and** a location —
Google's event results need both), BreadcrumbList (everything else). Search results and "not found" views are `noindex`.

Site facts (address, name, default description, share image) live in `src/app/Services/seo.config.ts`; the sitemap
script repeats the site address and route list — keep them in step with `src/app/app.routes.ts`.

Tests: `ng test` (SeoService and component specs) and `node --test scripts/test/generate-seo-files.test.mjs`.

After a deploy: submit `https://brothersof1-5-1.org/sitemap.xml` once in Google Search Console (Sitemaps), and use
URL Inspection on a page or two. Check social previews with the Facebook Sharing Debugger.
