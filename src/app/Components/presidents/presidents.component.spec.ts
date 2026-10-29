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

  const flushPosts = (body: any) =>
    http.expectOne(r => r.url === environment.restUrl + 'posts?_embed').flush(body);
  const pageBySlug = (slug: string) =>
    http.expectOne(r => r.url === environment.restUrl + 'pages' && r.params.get('slug') === slug && r.params.has('_embed'));
  const render = async () => { fixture.detectChanges(); await fixture.whenStable(); return (fixture.nativeElement as HTMLElement).textContent ?? ''; };

  it('makes no page request (and no page-13 call) while no homepage slug is configured', async () => {
    await setup('');
    http.expectNone(r => r.url.startsWith(environment.restUrl + 'pages'));
    flushPosts([{ id: 7, title: { rendered: 'Post A' }, date: '2026-01-02T10:00:00' }]);
    const text = await render();
    expect(text).toContain('God Before All');
    expect(text).toContain('Strategic Objectives');
    expect(text).not.toContain('Continue Read More');
  });

  it('loads the homepage page by slug and renders its excerpt and the posts', async () => {
    await setup('about-1-5-1');
    pageBySlug('about-1-5-1').flush([{ id: 42, slug: 'about-1-5-1', title: { rendered: 'About' }, excerpt: { rendered: '<p>Excerpt text</p>' } }]);
    flushPosts([{ id: 7, title: { rendered: 'Post A' }, date: '2026-01-02T10:00:00' }]);
    const text = await render();
    expect(text).toContain('Excerpt text');
    expect(text).toContain('Continue Read More');
    expect(text).toContain('Post A');
    expect((fixture.nativeElement as HTMLElement).innerHTML).toContain('href="/pg/about-1-5-1"');
  });

  it('GraphQL: builds the excerpt from the page content and links to the slug', async () => {
    await setup('about-1-5-1', true);
    http.expectOne(r => r.method === 'POST' && r.url === environment.graphqlUrl && r.body?.variables?.slug === 'about-1-5-1')
      .flush({ data: { page: { databaseId: 19, slug: 'about-1-5-1', title: '1-5-1 History', date: null, content: '<p>Founded in <b>1982</b>.</p>', featuredImage: null } } });
    flushPosts([]);
    const text = await render();
    expect(text).toContain('Founded in 1982.');
    expect((fixture.nativeElement as HTMLElement).innerHTML).toContain('href="/pg/about-1-5-1"');
  });

  it('GraphQL: page null = only the static sections', async () => {
    await setup('nope', true);
    http.expectOne(r => r.method === 'POST' && r.url === environment.graphqlUrl).flush({ data: { page: null } });
    flushPosts([]);
    const text = await render();
    expect(text).toContain('Strategic Objectives');
    expect(text).not.toContain('Continue Read More');
  });

  it('shows only the static sections when the slug matches no page', async () => {
    await setup('does-not-exist');
    pageBySlug('does-not-exist').flush([]);
    flushPosts([]);
    const text = await render();
    expect(text).toContain('Strategic Objectives');
    expect(text).not.toContain('Continue Read More');
  });

  it('still renders the static sections when the page request fails', async () => {
    spyOn(console, 'error');
    await setup('about-1-5-1');
    pageBySlug('about-1-5-1').flush({}, { status: 500, statusText: 'Server Error' });
    flushPosts([]);
    const text = await render();
    expect(text).toContain('Strategic Objectives');
    expect(text).not.toContain('Continue Read More');
    expect(console.error).toHaveBeenCalled();
  });
});
