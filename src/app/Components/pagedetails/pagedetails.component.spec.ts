import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { Meta, Title } from '@angular/platform-browser';
import { BehaviorSubject } from 'rxjs';

import { PagedetailsComponent } from './pagedetails.component';
import { USE_GRAPHQL } from '../../Services/wordpress.service';
import { environment } from '../../../environments/environment';

/** How each data source answers a page-by-slug request. */
interface Source {
  name: string;
  useGraphql: boolean;
  request(http: HttpTestingController, slug: string): TestRequest;
  found(id: number, slug: string, title: string, withImage?: boolean): unknown;
  notFound: unknown;
}

const IMG = 'https://example.test/img.jpg';

const REST: Source = {
  name: 'REST',
  useGraphql: false,
  request: (http, slug) =>
    http.expectOne(r => r.url === environment.restUrl + 'pages' && r.params.get('slug') === slug && r.params.has('_embed')),
  found: (id, slug, title, withImage = true) => [{
    id, slug, date: '2026-01-02T10:00:00',
    title: { rendered: title }, content: { rendered: '<p>Body ' + id + '</p>' }, excerpt: { rendered: '<p>Body ' + id + '</p>' },
    _embedded: withImage ? { 'wp:featuredmedia': [{ media_details: { sizes: { full: { source_url: IMG } } } }] } : {},
  }],
  notFound: [],
};

const GRAPHQL: Source = {
  name: 'GraphQL',
  useGraphql: true,
  request: (http, slug) =>
    http.expectOne(r => r.method === 'POST' && r.url === environment.graphqlUrl && r.body?.variables?.slug === slug),
  found: (id, slug, title, withImage = true) => ({ data: { page: {
    databaseId: id, slug, title, uri: '/' + slug + '/', date: '2026-01-02T10:00:00', modified: null,
    content: '<p>Body ' + id + '</p>',
    featuredImage: withImage ? { node: { sourceUrl: IMG, altText: '', mediaDetails: null } } : null,
  } } }),
  notFound: { data: { page: null } },
};

for (const source of [REST, GRAPHQL]) {
  describe(`PagedetailsComponent (${source.name})`, () => {
    let fixture: ComponentFixture<PagedetailsComponent>;
    let http: HttpTestingController;
    let params: BehaviorSubject<ParamMap>;

    /** The News & Upcoming Events sidebar was removed (2026-10-30): the page must not request posts. */
    const flushSidebar = () =>
      http.expectNone(r => r.url === environment.restUrl + 'posts?_embed'); // no News & Upcoming Events sidebar any more

    const el = () => fixture.nativeElement as HTMLElement;
    const render = async () => { fixture.detectChanges(); await fixture.whenStable(); };

    async function setup(slug: string) {
      params = new BehaviorSubject<ParamMap>(convertToParamMap({ slug }));
      await TestBed.configureTestingModule({
        imports: [PagedetailsComponent],
        providers: [
          provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
          { provide: USE_GRAPHQL, useValue: source.useGraphql },
          { provide: ActivatedRoute, useValue: { paramMap: params.asObservable() } },
        ],
      }).compileComponents();
      fixture = TestBed.createComponent(PagedetailsComponent);
      http = TestBed.inject(HttpTestingController);
      fixture.detectChanges();
    }

    afterEach(() => { flushSidebar(); http.verify(); });

    it('loads the page for the route slug once and renders it, with title and description', async () => {
      await setup('about-1-5-1');
      source.request(http, 'about-1-5-1').flush(source.found(19, 'about-1-5-1', '1-5-1 History'));
      await render();
      expect(el().textContent).toContain('1-5-1 History');
      expect(el().textContent).toContain('Body 19');
      expect((el().querySelector('#margintransition') as HTMLElement).style.backgroundImage).toContain(IMG);
      expect(el().querySelector('app-pagenotfound')).toBeNull();
      expect(TestBed.inject(Title).getTitle()).toBe('1-5-1 History');
      expect(TestBed.inject(Meta).getTag('name="description"')?.content).toBe('Body 19');
    });

    it('re-fetches when the route slug changes', async () => {
      await setup('about-1-5-1');
      source.request(http, 'about-1-5-1').flush(source.found(19, 'about-1-5-1', '1-5-1 History'));
      params.next(convertToParamMap({ slug: 'membership' }));
      source.request(http, 'membership').flush(source.found(29, 'membership', 'Membership Requirement'));
      await render();
      expect(el().textContent).toContain('Membership Requirement');
    });

    it('shows the 404 view when no page has that slug', async () => {
      await setup('no-such-page');
      source.request(http, 'no-such-page').flush(source.notFound);
      await render();
      expect(el().querySelector('app-pagenotfound')).not.toBeNull();
      expect(el().textContent).toContain('404');
      expect(el().querySelector('section.error_section a')?.getAttribute('href')).toBe('/');
    });

    it('has no News & Upcoming Events sidebar; the page content uses the full row', async () => {
      await setup('about-1-5-1');
      source.request(http, 'about-1-5-1').flush(source.found(19, 'about-1-5-1', '1-5-1 History'));
      await render();
      expect(el().querySelector('app-sidbarposts')).toBeNull();
      expect(el().textContent).not.toContain('News & Upcoming Events');
      const content = Array.from(el().querySelectorAll('.bgPage .row > div')).find(d => d.textContent?.includes('Body 19'))!;
      expect(content.className.trim()).toBe('col-12 text-justify');
      expect(content.parentElement!.children.length).toBe(1);
    });

    it('renders a page without a featured image (no hero background, no error)', async () => {
      await setup('moto');
      source.request(http, 'moto').flush(source.found(17, 'moto', 'Moto', false));
      await render();
      expect(el().textContent).toContain('Moto');
      expect((el().querySelector('#margintransition') as HTMLElement).style.backgroundImage).toBe('');
    });

    it('renders nothing (and logs) when the request fails — not a 404', async () => {
      spyOn(console, 'error');
      await setup('about-1-5-1');
      source.request(http, 'about-1-5-1').flush({}, { status: 500, statusText: 'Server Error' });
      await render();
      expect(el().querySelector('section')).toBeNull();
      expect(el().querySelector('app-pagenotfound')).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });
  });
}

describe('PagedetailsComponent (GraphQL errors[])', () => {
  it('treats a 200 response with errors[] as a failure: logged, nothing rendered, not a 404', async () => {
    const params = new BehaviorSubject<ParamMap>(convertToParamMap({ slug: 'about-1-5-1' }));
    await TestBed.configureTestingModule({
      imports: [PagedetailsComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: USE_GRAPHQL, useValue: true },
        { provide: ActivatedRoute, useValue: { paramMap: params.asObservable() } },
      ],
    }).compileComponents();
    spyOn(console, 'error');
    const fixture = TestBed.createComponent(PagedetailsComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    GRAPHQL.request(http, 'about-1-5-1').flush({ data: { page: null }, errors: [{ message: 'Field failed' }] });
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('section')).toBeNull();
    expect(el.querySelector('app-pagenotfound')).toBeNull();
    expect(console.error).toHaveBeenCalled();
    http.match(() => true).forEach(r => r.flush([]));
  });
});
