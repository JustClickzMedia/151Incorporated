import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { PresidentsComponent } from './presidents.component';
import { HOMEPAGE_SLUG } from '../../homepage.config';
import { USE_GRAPHQL } from '../../Services/wordpress.service';
import { environment } from '../../../environments/environment';

describe('PresidentsComponent', () => {
  let fixture: ComponentFixture<PresidentsComponent>;
  let http: HttpTestingController;

  async function setup(slug: string, useGraphql = false) {
    await TestBed.configureTestingModule({
      imports: [PresidentsComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
                  { provide: HOMEPAGE_SLUG, useValue: slug }, { provide: USE_GRAPHQL, useValue: useGraphql }],
    }).compileComponents();
    fixture = TestBed.createComponent(PresidentsComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  /** News & Upcoming Events was removed (2026-10-30), so the homepage no longer requests posts. */
  const noPostsRequest = () =>
    http.expectNone(r => r.url.startsWith(environment.restUrl + 'posts'));
  const pageBySlug = (slug: string) =>
    http.expectOne(r => r.url === environment.restUrl + 'pages' && r.params.get('slug') === slug && r.params.has('_embed'));
  const render = async () => { fixture.detectChanges(); await fixture.whenStable(); return (fixture.nativeElement as HTMLElement).textContent ?? ''; };

  it('makes no page request (and no page-13 call) while no homepage slug is configured', async () => {
    await setup('');
    http.expectNone(r => r.url.startsWith(environment.restUrl + 'pages'));
    noPostsRequest();
    const text = await render();
    expect(text).toContain('God Before All');
    expect(text).toContain('Strategic Objectives');
    expect(text).not.toContain('Continue Read More');
  });

  it('loads the homepage page by slug and renders its excerpt', async () => {
    await setup('about-1-5-1');
    pageBySlug('about-1-5-1').flush([{ id: 42, slug: 'about-1-5-1', title: { rendered: 'About' }, excerpt: { rendered: '<p>Excerpt text</p>' } }]);
    noPostsRequest();
    const text = await render();
    expect(text).toContain('Excerpt text');
    expect(text).toContain('Continue Read More');
    expect((fixture.nativeElement as HTMLElement).innerHTML).toContain('href="/pg/about-1-5-1"');
  });

  it('GraphQL: builds the excerpt from the page content and links to the slug', async () => {
    await setup('about-1-5-1', true);
    http.expectOne(r => r.method === 'POST' && r.url === environment.graphqlUrl && r.body?.variables?.slug === 'about-1-5-1')
      .flush({ data: { page: { databaseId: 19, slug: 'about-1-5-1', title: '1-5-1 History', date: null, content: '<p>Founded in <b>1982</b>.</p>', featuredImage: null } } });
    noPostsRequest();
    const text = await render();
    expect(text).toContain('Founded in 1982.');
    expect((fixture.nativeElement as HTMLElement).innerHTML).toContain('href="/pg/about-1-5-1"');
  });

  it('GraphQL: page null = only the static sections', async () => {
    await setup('nope', true);
    http.expectOne(r => r.method === 'POST' && r.url === environment.graphqlUrl).flush({ data: { page: null } });
    noPostsRequest();
    const text = await render();
    expect(text).toContain('Strategic Objectives');
    expect(text).not.toContain('Continue Read More');
  });

  // Strategic Objectives / News used to exist twice: a desktop copy that only rendered once a homepage page had
  // loaded, and a mobile copy hidden from 768px up — so tablets, laptops and desktops showed neither.
  const visibleHeadings = (text: string) => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('h2, h3'))
    .filter(h => h.textContent?.includes(text));
  const hiddenOnSomeScreens = (h: Element) => {
    for (let e: Element | null = h; e && e !== fixture.nativeElement; e = e.parentElement) {
      if (/\bd-(none|md-none|lg-none|xl-none)\b/.test(e.className)) { return true; }
    }
    return false;
  };

  it('shows Strategic Objectives exactly once, on every screen size, with no homepage page', async () => {
    await setup('');
    noPostsRequest();
    await render();
    const headings = visibleHeadings('Strategic Objectives');
    expect(headings.length).toBe(1);
    expect(hiddenOnSomeScreens(headings[0])).withContext('hidden by a d-*-none class').toBeFalse();
  });

  it('no longer has a News & Upcoming Events section', async () => {
    await setup('');
    noPostsRequest();
    const text = await render();
    expect(text).not.toContain('News & Upcoming Events');
    expect((fixture.nativeElement as HTMLElement).querySelector('#postNav')).toBeNull();
  });

  it('shows Strategic Objectives once, on every screen size, next to the homepage excerpt', async () => {
    await setup('about-1-5-1');
    pageBySlug('about-1-5-1').flush([{ id: 42, slug: 'about-1-5-1', title: { rendered: 'About' }, excerpt: { rendered: '<p>Excerpt text</p>' } }]);
    noPostsRequest();
    await render();
    const headings = visibleHeadings('Strategic Objectives');
    expect(headings.length).toBe(1);
    expect(hiddenOnSomeScreens(headings[0])).toBeFalse();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Excerpt text');
  });

  it('shows only the static sections when the slug matches no page', async () => {
    await setup('does-not-exist');
    pageBySlug('does-not-exist').flush([]);
    noPostsRequest();
    const text = await render();
    expect(text).toContain('Strategic Objectives');
    expect(text).not.toContain('Continue Read More');
  });

  it('still renders the static sections when the page request fails', async () => {
    spyOn(console, 'error');
    await setup('about-1-5-1');
    pageBySlug('about-1-5-1').flush({}, { status: 500, statusText: 'Server Error' });
    noPostsRequest();
    const text = await render();
    expect(text).toContain('Strategic Objectives');
    expect(text).not.toContain('Continue Read More');
    expect(console.error).toHaveBeenCalled();
  });

  it('starts with the "God Before All" band: no empty strip above it', async () => {
    await setup('');
    await render();
    const section = (fixture.nativeElement as HTMLElement).querySelector('section')!;
    expect(section.querySelector('#presidentheader')).toBeNull();
    expect(section.firstElementChild?.classList).toContain('bgTitle');
  });
});
