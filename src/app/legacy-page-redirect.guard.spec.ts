import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Location } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { legacyPageRedirectGuard } from './legacy-page-redirect.guard';
import { environment } from '../environments/environment';

@Component({ template: 'PAGE' }) class PageStub {}
@Component({ template: 'NOT FOUND' }) class NotFoundStub {}

describe('legacyPageRedirectGuard (/pg/:id/:title -> /pg/:slug)', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        provideRouter([
          { path: 'pg/:slug', component: PageStub },
          { path: 'pg/:id/:title', canActivate: [legacyPageRedirectGuard], children: [] },
          { path: '404', component: NotFoundStub },
        ]),
      ],
    });
    harness = await RouterTestingHarness.create();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const navigate = (url: string) => harness.navigateByUrl(url);
  /** Navigation runs the guard asynchronously; wait a macrotask so its HTTP request exists. */
  const settle = () => new Promise(resolve => setTimeout(resolve));
  const slugRequest = async (id: number) => {
    await settle();
    return http.expectOne(r => r.url === environment.restUrl + 'pages/' + id && r.params.get('_fields') === 'slug');
  };

  it('redirects a known page ID to its slug URL', async () => {
    const nav = navigate('/pg/19/1-5-1 History');
    (await slugRequest(19)).flush({ slug: 'about-1-5-1' });
    await nav;
    expect(TestBed.inject(Router).url).toBe('/pg/about-1-5-1');
    expect(harness.routeNativeElement?.textContent).toContain('PAGE');
  });

  it('shows the 404 view for an ID WordPress does not have (page 13) without changing the URL to /404', async () => {
    const nav = navigate('/pg/13/Presidents%20Message');
    (await slugRequest(13)).flush({ code: 'rest_post_invalid_id' }, { status: 404, statusText: 'Not Found' });
    await nav;
    expect(harness.routeNativeElement?.textContent).toContain('NOT FOUND');
    expect(TestBed.inject(Location).path()).not.toBe('/404');
  });

  it('shows the 404 view for a non-numeric ID without calling WordPress', async () => {
    await navigate('/pg/abc/whatever');
    http.expectNone(() => true);
    expect(harness.routeNativeElement?.textContent).toContain('NOT FOUND');
  });

  it('shows the 404 view (and logs) when the lookup fails', async () => {
    spyOn(console, 'error');
    const nav = navigate('/pg/19/1-5-1 History');
    (await slugRequest(19)).flush({}, { status: 500, statusText: 'Server Error' });
    await nav;
    expect(harness.routeNativeElement?.textContent).toContain('NOT FOUND');
    expect(console.error).toHaveBeenCalled();
  });
});
