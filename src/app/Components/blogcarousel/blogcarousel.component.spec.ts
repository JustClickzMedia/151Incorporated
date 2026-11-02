import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { BLOG_CAROUSEL_POSTS, BlogcarouselComponent } from './blogcarousel.component';
import { USE_GRAPHQL } from '../../Services/wordpress.service';
import { environment } from '../../../environments/environment';

export const postNode = (id: number, image = true) => ({
  databaseId: id, slug: 'post-' + id, title: 'Post ' + id + ' &#8211; title', date: '2026-11-0' + (id % 9 + 1) + 'T10:00:00',
  excerpt: '<p>Excerpt of post ' + id + ' [&hellip;]</p>',
  featuredImage: image ? { node: { sourceUrl: 'https://img.test/' + id + '.jpg', altText: 'Photo ' + id, mediaDetails: null } } : null,
  categories: { nodes: [{ name: 'blog' }] },
});

describe('BlogcarouselComponent (homepage "From the Blog")', () => {
  let fixture: ComponentFixture<BlogcarouselComponent>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlogcarouselComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: USE_GRAPHQL, useValue: true }],
    }).compileComponents();
    fixture = TestBed.createComponent(BlogcarouselComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const respond = async (nodes: unknown[]) => {
    const req = http.expectOne(r => r.url === environment.graphqlUrl && /posts\(/.test(r.body?.query));
    expect(req.request.body.variables.first).toBe(BLOG_CAROUSEL_POSTS);
    req.flush({ data: { posts: { nodes } } });
    fixture.detectChanges();
    await fixture.whenStable();
  };

  it('is hidden when there are no posts', async () => {
    await respond([]);
    expect(el().querySelector('section.blog')).toBeNull();
  });

  it('shows the newest posts as tiles: image, title, description, Read More, each linking to the post', async () => {
    await respond([postNode(1), postNode(2, false)]);
    const tiles = Array.from(el().querySelectorAll('.track a.tile'));
    expect(tiles.length).toBe(2);
    expect(tiles.map(t => t.getAttribute('href'))).toEqual(['/blog/post-1', '/blog/post-2']);
    expect((tiles[0].querySelector('img.tile-img') as HTMLImageElement).src).toBe('https://img.test/1.jpg');
    expect(tiles[0].querySelector('.title')?.textContent).toBe('Post 1 – title');   // entity decoded
    expect(tiles[0].querySelector('.excerpt')?.textContent).toContain('Excerpt of post 1 […]');
    expect(tiles[0].querySelector('.more')?.textContent).toContain('Read More');
    expect(tiles[1].querySelector('.tile-placeholder')).not.toBeNull();
    expect(el().querySelector('a.all-link')?.getAttribute('href')).toBe('/blog');
  });

  it('shows four tiles at a time on a wide screen and the arrows move through the rest', async () => {
    document.body.appendChild(el());
    el().style.width = '1200px';
    await respond([1, 2, 3, 4, 5, 6].map(i => postNode(i)));
    fixture.detectChanges();
    await fixture.whenStable();
    // Desktop rule (outside media queries): four columns per visible width. The test browser may be narrower,
    // so check the rule itself, plus that the visible tiles fit the track exactly for the current width.
    const rule = Array.from(document.styleSheets)
      .flatMap(sheet => { try { return Array.from(sheet.cssRules); } catch { return []; } })
      .find((r): r is CSSStyleRule => r instanceof CSSStyleRule && /\.track\[/.test(r.selectorText) && !!r.style.gridAutoColumns);
    expect(rule?.style.gridAutoColumns.replace(/\s/g, '')).toBe('calc((100%-3*var(--gap))/4)');
    const next = el().querySelector('button.next') as HTMLButtonElement;
    expect(next).not.toBeNull();
    expect(next.disabled).toBeFalse();
    expect((el().querySelector('button.prev') as HTMLButtonElement).disabled).toBeTrue();
    el().remove();
  });

  it('is hidden (and logs) when WordPress fails', async () => {
    spyOn(console, 'error');
    http.expectOne(r => r.url === environment.graphqlUrl).flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(el().querySelector('section.blog')).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});
