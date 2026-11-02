import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PORTAL_CONFIG, PortalApiService, PortalError } from './portal-api.service';
import { GraphqlError } from '../graphql.service';

const API = 'https://wp.test/wp-json/b151/v1';
const GQL = 'https://wp.test/graphql';
const member = { id: 7, display_name: 'Bro Test', email: 'b@test', membership_number: '151-00007', status: 'active', classification: 'member',
  chapter: { id: 3, name: 'Alpha' }, is_active: true, is_backend: false, capabilities: [] };
const session = (nonce = 'n1') => ({ authenticated: true, nonce, member, idle_seconds_remaining: 1700, idle_limit_seconds: 1800,
  warning_seconds: 120, expires_at: '2030-01-01T00:00:00Z', admin_session: false });

describe('PortalApiService', () => {
  let api: PortalApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: PORTAL_CONFIG, useValue: { apiUrl: 'https://wp.test', graphqlUrl: GQL } }],
    });
    api = TestBed.inject(PortalApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('signs in with cookies and keeps the nonce in memory only', () => {
    let name = '';
    api.signIn('b@test', 'secret password').subscribe(m => name = m.display_name);
    const req = http.expectOne(`${API}/session`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.body).toEqual({ username: 'b@test', password: 'secret password' });
    req.flush(session(), { status: 201, statusText: 'Created' });
    expect(name).toBe('Bro Test');
    expect(api.signedIn()).toBeTrue();
    expect(localStorage.getItem('nonce')).toBeNull();
    expect(JSON.stringify(sessionStorage)).not.toContain('n1');
  });

  it('shows the server\'s generic message for a failed sign-in', () => {
    let err: PortalError | undefined;
    api.signIn('b@test', 'wrong').subscribe({ error: e => err = e });
    http.expectOne(`${API}/session`).flush({ code: 'b151_invalid_login', message: 'The email or password is not correct, or this account is not active yet.', data: { status: 401 } },
      { status: 401, statusText: 'Unauthorized' });
    expect(err?.code).toBe('b151_invalid_login');
    expect(err?.message).toContain('not correct');
    expect(api.signedIn()).toBeFalse();
  });

  it('passes on the admin sign-in link for two-step accounts', () => {
    let err: PortalError | undefined;
    api.signIn('admin@test', 'pw').subscribe({ error: e => err = e });
    http.expectOne(`${API}/session`).flush({ code: 'b151_use_admin_sign_in', message: 'Use the admin page.', data: { status: 403, sign_in_url: 'https://wp.test/wp-login.php' } },
      { status: 403, statusText: 'Forbidden' });
    expect(err?.signInUrl).toBe('https://wp.test/wp-login.php');
  });

  it('sends member GraphQL with cookies and X-WP-Nonce', () => {
    api.ensureSession().subscribe();
    http.expectOne(`${API}/session`).flush(session('abc'));
    let data: unknown;
    api.graphql('{ currentMember { id } }').subscribe(d => data = d);
    const req = http.expectOne(GQL);
    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.headers.get('X-WP-Nonce')).toBe('abc');
    req.flush({ data: { currentMember: { id: 7 } } });
    expect(data).toEqual({ currentMember: { id: 7 } });
  });

  it('refreshes an expired nonce once and retries', () => {
    api.ensureSession().subscribe();
    http.expectOne(`${API}/session`).flush(session('old'));
    let data: unknown;
    api.graphql('{ x }').subscribe(d => data = d);
    http.expectOne(GQL).flush({ code: 'rest_cookie_invalid_nonce' }, { status: 403, statusText: 'Forbidden' });
    http.expectOne(`${API}/session`).flush(session('new'));
    const retry = http.expectOne(GQL);
    expect(retry.request.headers.get('X-WP-Nonce')).toBe('new');
    retry.flush({ data: { x: 1 } });
    expect(data).toEqual({ x: 1 });
  });

  it('signs out locally when the session is gone', () => {
    api.ensureSession().subscribe();
    http.expectOne(`${API}/session`).flush(session('old'));
    let err: unknown;
    api.graphql('{ x }').subscribe({ error: e => err = e });
    http.expectOne(GQL).flush({}, { status: 403, statusText: 'Forbidden' });
    http.expectOne(`${API}/session`).flush({ authenticated: false });
    expect(err instanceof PortalError).toBeTrue();
    expect(api.signedIn()).toBeFalse();
  });

  it('turns GraphQL errors into GraphqlError', () => {
    let err: unknown;
    api.graphql('{ x }').subscribe({ error: e => err = e });
    http.expectOne(GQL).flush({ errors: [{ message: 'You do not have permission to do that.' }] });
    expect(err instanceof GraphqlError).toBeTrue();
  });

  it('checks the session once per page load', () => {
    api.ensureSession().subscribe();
    api.ensureSession().subscribe();
    http.expectOne(`${API}/session`).flush({ authenticated: false });
    let again: boolean | undefined;
    api.ensureSession().subscribe(v => again = v);
    http.expectNone(`${API}/session`);
    expect(again).toBeFalse();
    expect(api.checked()).toBeTrue();
  });

  it('passive checks say so, so they never extend the session', () => {
    api.refresh(true).subscribe();
    const req = http.expectOne(`${API}/session`);
    expect(req.request.headers.get('X-B151-Activity')).toBe('passive');
    req.flush(session());
  });

  it('builds Google/Microsoft start links that only return inside the member area', () => {
    expect(api.oauthStartUrl('google', '/members/events')).toBe(`${API}/oauth/google/start?return=%2Fmembers%2Fevents`);
    expect(api.oauthStartUrl('microsoft', '/members/profile', true)).toContain('mode=link');
  });

  it('sign out clears the session even if the request fails', () => {
    api.ensureSession().subscribe();
    http.expectOne(`${API}/session`).flush(session());
    api.signOut().subscribe();
    http.expectOne(r => r.method === 'DELETE').flush({}, { status: 500, statusText: 'Error' });
    expect(api.signedIn()).toBeFalse();
  });
});
