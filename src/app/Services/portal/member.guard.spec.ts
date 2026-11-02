import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { guestGuard, memberGuard, safeReturn } from './member.guard';
import { PORTAL_CONFIG } from './portal-api.service';

@Component({ template: 'page' }) class PageComponent {}
const API = 'https://wp.test/wp-json/b151/v1/session';

describe('member area guards', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: PORTAL_CONFIG, useValue: { apiUrl: 'https://wp.test', graphqlUrl: 'https://wp.test/graphql' } },
        provideRouter([
          { path: 'members/sign-in', canActivate: [guestGuard], component: PageComponent },
          { path: 'members', canActivate: [memberGuard], children: [{ path: '**', component: PageComponent }] },
        ]),
      ],
    });
    harness = await RouterTestingHarness.create();
    http = TestBed.inject(HttpTestingController);
  });

  it('sends signed-out visitors to sign-in, remembering where they were going', async () => {
    const nav = harness.navigateByUrl('/members/directory');
    await new Promise(r => setTimeout(r));
    http.expectOne(API).flush({ authenticated: false });
    await nav;
    expect(TestBed.inject(Router).url).toBe('/members/sign-in?return=%2Fmembers%2Fdirectory');
  });

  it('lets signed-in members in, and skips the sign-in page for them', async () => {
    const nav = harness.navigateByUrl('/members/events');
    await new Promise(r => setTimeout(r));
    http.expectOne(API).flush({ authenticated: true, nonce: 'n', idle_seconds_remaining: 100, idle_limit_seconds: 1800, warning_seconds: 120,
      expires_at: null, admin_session: false, member: { id: 1, display_name: 'B', capabilities: [] } });
    await nav;
    expect(TestBed.inject(Router).url).toBe('/members/events');
    await harness.navigateByUrl('/members/sign-in?return=%2Fmembers%2Fprofile');
    expect(TestBed.inject(Router).url).toBe('/members/profile');
  });

  it('only returns to paths inside the member area', () => {
    expect(safeReturn('/members/events')).toBe('/members/events');
    expect(safeReturn('//evil.example')).toBe('/members');
    expect(safeReturn('https://evil.example/members')).toBe('/members');
    expect(safeReturn('/blog')).toBe('/members');
    expect(safeReturn('/members/sign-in')).toBe('/members');
    expect(safeReturn(null)).toBe('/members');
  });
});
