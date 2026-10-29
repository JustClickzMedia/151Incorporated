import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { GRAPHQL_URL, GraphqlError, GraphqlService } from './graphql.service';
import { environment } from '../../environments/environment';

describe('GraphqlService', () => {
  let service: GraphqlService;
  let http: HttpTestingController;
  const URL = 'https://example.test/graphql';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: GRAPHQL_URL, useValue: URL }],
    });
    service = TestBed.inject(GraphqlService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('defaults to environment.graphqlUrl (staging in dev)', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    expect(TestBed.inject(GRAPHQL_URL)).toBe(environment.graphqlUrl);
    expect(environment.graphqlUrl).toContain('/staging/1848/graphql');
  });

  it('POSTs { query, variables } as JSON, anonymously, and emits data', () => {
    let data: any;
    service.query<{ page: { slug: string } }>('query Q($slug: ID!) { page(id: $slug) { slug } }', { slug: 'moto' })
      .subscribe(d => data = d);
    const req = http.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ query: 'query Q($slug: ID!) { page(id: $slug) { slug } }', variables: { slug: 'moto' } });
    expect(req.request.withCredentials).toBeFalse();
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({ data: { page: { slug: 'moto' } } });
    expect(data).toEqual({ page: { slug: 'moto' } });
  });

  it('treats HTTP 200 with errors[] as a failure (GraphqlError)', () => {
    let error: any;
    service.query('{ x }').subscribe({ error: e => error = e });
    http.expectOne(URL).flush({ data: null, errors: [{ message: 'Cannot query field "x"' }] });
    expect(error instanceof GraphqlError).toBeTrue();
    expect(error.errors[0].message).toContain('Cannot query field');
  });

  it('treats errors[] as a failure even when partial data came back', () => {
    let error: any;
    service.query('{ a b }').subscribe({ next: () => fail('should not emit'), error: e => error = e });
    http.expectOne(URL).flush({ data: { a: 1, b: null }, errors: [{ message: 'b failed', path: ['b'] }] });
    expect(error instanceof GraphqlError).toBeTrue();
  });

  it('turns HTTP 500 with an errors body (syntax error) into a GraphqlError', () => {
    let error: any;
    service.query('{ broken').subscribe({ error: e => error = e });
    http.expectOne(URL).flush({ errors: [{ message: 'Syntax Error' }] }, { status: 500, statusText: 'Server Error' });
    expect(error instanceof GraphqlError).toBeTrue();
    expect(error.message).toContain('Syntax Error');
  });

  it('passes other HTTP errors through unchanged', () => {
    let error: any;
    service.query('{ x }').subscribe({ error: e => error = e });
    http.expectOne(URL).flush('nope', { status: 503, statusText: 'Unavailable' });
    expect(error instanceof GraphqlError).toBeFalse();
    expect(error.status).toBe(503);
  });

  it('fails when the response has no data', () => {
    let error: any;
    service.query('{ x }').subscribe({ error: e => error = e });
    http.expectOne(URL).flush({});
    expect(error instanceof GraphqlError).toBeTrue();
  });
});
