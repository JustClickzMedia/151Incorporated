import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { WordpressService } from './wordpress.service';
import { environment } from '../../environments/environment';

describe('WordpressService', () => {
  let service: WordpressService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [WordpressService, provideHttpClient(withXhr()), provideHttpClientTesting()]
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
