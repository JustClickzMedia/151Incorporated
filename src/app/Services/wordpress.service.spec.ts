import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { WordpressService } from './wordpress.service';
import { environment } from '../../environments/environment';

describe('WordpressService', () => {
  let service: WordpressService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [WordpressService, provideHttpClient(), provideHttpClientTesting()]
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
});
