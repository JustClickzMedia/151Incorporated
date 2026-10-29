import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { USE_GRAPHQL, WordpressService } from './wordpress.service';
import { environment } from '../../environments/environment';

describe('WordpressService', () => {
  let service: WordpressService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [WordpressService, provideHttpClient(withXhr()), provideHttpClientTesting(), { provide: USE_GRAPHQL, useValue: false }]
    });
    service = TestBed.inject(WordpressService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('takes its REST base URL from the environment (no hard-coded wp-json URL)', () => {
    expect(environment.restUrl).toMatch(/\/wp-json\/wp\/v2\/$/);
    expect(service.baseUrl).toBe(environment.restUrl);
  });

  it('defines a GraphQL URL in the environment', () => {
    expect(environment.graphqlUrl).toMatch(/^https:\/\/.+\/graphql$/);
  });

  it('getPage() still calls the REST pages endpoint under environment.restUrl', () => {
    service.getPage(13).subscribe();
    const req = httpMock.expectOne(environment.restUrl + 'pages/13?_embed');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('getPosts() still calls the REST posts endpoint under environment.restUrl', () => {
    service.getPosts().subscribe();
    const req = httpMock.expectOne(r => r.url === environment.restUrl + 'posts?_embed');
    expect(req.request.params.get('per_page')).toBe('6');
    req.flush([]);
  });

  it('getPageBySlug() queries pages by slug and emits the first match', () => {
    let result: any = 'unset';
    service.getPageBySlug('about-1-5-1').subscribe(p => result = p);
    const req = httpMock.expectOne(r => r.url === environment.restUrl + 'pages');
    expect(req.request.params.get('slug')).toBe('about-1-5-1');
    expect(req.request.params.has('_embed')).toBeTrue();
    req.flush([{ id: 42, slug: 'about-1-5-1' }]);
    expect(result.id).toBe(42);
  });

  it('getPageBySlug() maps the REST page to WpPage', () => {
    let result: any;
    service.getPageBySlug('about-1-5-1').subscribe(p => result = p);
    httpMock.expectOne(r => r.url === environment.restUrl + 'pages').flush([{
      id: 19, slug: 'about-1-5-1', date: 'd', title: { rendered: 'History' }, content: { rendered: '<p>C</p>' }, excerpt: { rendered: '<p>E</p>' },
      _embedded: { 'wp:featuredmedia': [{ alt_text: 'alt', media_details: { sizes: { full: { source_url: 'https://x/img.jpg' } } } }] },
    }]);
    expect(result).toEqual({ id: 19, slug: 'about-1-5-1', title: 'History', contentHtml: '<p>C</p>', excerptHtml: '<p>E</p>',
      excerptText: 'E', date: 'd', featuredImage: { url: 'https://x/img.jpg', alt: 'alt' } });
  });

  it('getMenuPages() maps REST pages to id/slug/title', () => {
    let result: any;
    service.getMenuPages().subscribe(p => result = p);
    httpMock.expectOne(r => r.url.startsWith(environment.restUrl + 'pages?_embed')).flush([{ id: 29, slug: 'membership', title: { rendered: 'Membership' } }]);
    expect(result).toEqual([{ id: 29, slug: 'membership', title: 'Membership' }]);
  });

  it('getPageBySlug() emits undefined when no page has that slug', () => {
    let result: any = 'unset';
    service.getPageBySlug('nope').subscribe(p => result = p);
    httpMock.expectOne(r => r.url === environment.restUrl + 'pages').flush([]);
    expect(result).toBeUndefined();
  });

  it('getPageSlugById() asks for just the slug of that page ID', () => {
    let result: any = 'unset';
    service.getPageSlugById(19).subscribe(s => result = s);
    const req = httpMock.expectOne(r => r.url === environment.restUrl + 'pages/19');
    expect(req.request.params.get('_fields')).toBe('slug');
    req.flush({ slug: 'about-1-5-1' });
    expect(result).toBe('about-1-5-1');
  });

  it('defines an empty homepage slug until the homepage is chosen', () => {
    expect(environment.homepageSlug).toBe('');
  });
});

describe('WordpressService (GraphQL)', () => {
  let service: WordpressService;
  let httpMock: HttpTestingController;
  const gqlRequest = () => httpMock.expectOne(r => r.method === 'POST' && r.url === environment.graphqlUrl);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [WordpressService, provideHttpClient(withXhr()), provideHttpClientTesting(), { provide: USE_GRAPHQL, useValue: true }]
    });
    service = TestBed.inject(WordpressService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('is the default for staging/dev, but production stays on REST until promotion', () => {
    expect(environment.useGraphql).toBeTrue();
  });

  it('getPageBySlug() sends the contract PageBySlug query and maps the page', () => {
    let result: any;
    service.getPageBySlug('about-1-5-1').subscribe(p => result = p);
    const req = gqlRequest();
    expect(req.request.body.query).toContain('page(id: $slug, idType: URI)');
    expect(req.request.body.variables).toEqual({ slug: 'about-1-5-1' });
    expect(req.request.withCredentials).toBeFalse();
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({ data: { page: { databaseId: 19, slug: 'about-1-5-1', title: 'History', date: 'd', content: '<p>C</p>',
      featuredImage: { node: { sourceUrl: 'https://x/staging/1848/img.jpg', altText: '' } } } } });
    expect(result).toEqual({ id: 19, slug: 'about-1-5-1', title: 'History', contentHtml: '<p>C</p>', excerptHtml: '<p>C</p>',
      excerptText: 'C', date: 'd', featuredImage: { url: 'https://x/staging/1848/img.jpg', alt: '' } });
  });

  it('getPageBySlug() emits undefined for page: null', () => {
    let result: any = 'unset';
    service.getPageBySlug('nope').subscribe(p => result = p);
    gqlRequest().flush({ data: { page: null } });
    expect(result).toBeUndefined();
  });

  it('getMenuPages() maps GraphQL page nodes to id/slug/title', () => {
    let result: any;
    service.getMenuPages().subscribe(p => result = p);
    const req = gqlRequest();
    expect(req.request.body.query).toContain('orderby: { field: MENU_ORDER, order: ASC }');
    req.flush({ data: { pages: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [{ databaseId: 29, slug: 'membership', title: 'Membership', uri: '/membership/' }] } } });
    expect(result).toEqual([{ id: 29, slug: 'membership', title: 'Membership' }]);
  });

  it('getPageSlugById() still uses REST (old-link redirects)', () => {
    service.getPageSlugById(19).subscribe();
    httpMock.expectOne(r => r.url === environment.restUrl + 'pages/19').flush({ slug: 'about-1-5-1' });
  });
});
