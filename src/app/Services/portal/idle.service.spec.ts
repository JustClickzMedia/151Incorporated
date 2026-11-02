import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { IdleService, KEEPALIVE_MS } from './idle.service';
import { PORTAL_CONFIG, PortalApiService } from './portal-api.service';
import { NOW } from '../../Model/now';

const API = 'https://wp.test/wp-json/b151/v1/session';
const session = (remaining: number) => ({ authenticated: true, nonce: 'n', idle_seconds_remaining: remaining, idle_limit_seconds: 1800,
  warning_seconds: 120, expires_at: null, admin_session: false,
  member: { id: 1, display_name: 'B', email: '', membership_number: '', status: 'active', classification: 'member', chapter: null, is_active: true, is_backend: false, capabilities: [] } });

describe('IdleService', () => {
  let clock: number;
  let idle: IdleService;
  let api: PortalApiService;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    clock = Date.UTC(2030, 0, 1, 12, 0, 0);
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(clock));
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: PORTAL_CONFIG, useValue: { apiUrl: 'https://wp.test', graphqlUrl: 'https://wp.test/graphql' } },
        { provide: NOW, useValue: () => new Date(clock) }],
    });
    idle = TestBed.inject(IdleService);
    api = TestBed.inject(PortalApiService);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    api.refresh().subscribe();
    http.expectOne(API).flush(session(1800));
  });

  afterEach(() => { idle.stop(); jasmine.clock().uninstall(); });

  const advance = (ms: number) => { clock += ms; jasmine.clock().mockDate(new Date(clock)); };

  it('shows nothing while there is plenty of time', () => {
    idle.start();
    advance(10 * 60_000);
    idle.tick();
    expect(idle.warningSecondsLeft()).toBeNull();
    http.expectNone(API);
  });

  it('warns two minutes before and checks the server passively', () => {
    idle.start();
    advance(28.5 * 60_000);
    idle.tick();
    expect(idle.warningSecondsLeft()).toBe(90);
    const req = http.expectOne(API);
    expect(req.request.headers.get('X-B151-Activity')).toBe('passive');
    req.flush(session(90));
    expect(idle.warningSecondsLeft()).toBe(90);
  });

  it('hides the warning when another tab kept the session alive', () => {
    idle.start();
    advance(28.5 * 60_000);
    idle.tick();
    http.expectOne(API).flush(session(1500));
    expect(idle.warningSecondsLeft()).toBeNull();
  });

  it('signs out at zero and goes to the sign-in page', () => {
    idle.start();
    advance(31 * 60_000);
    idle.tick();
    expect(api.signedIn()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/members/sign-in'], { queryParams: { reason: 'idle' } });
  });

  it('pings the server while the member is active, at most every 5 minutes', () => {
    idle.start();
    advance(60_000);
    document.dispatchEvent(new Event('click'));
    advance(KEEPALIVE_MS);
    idle.tick();
    const req = http.expectOne(API);
    expect(req.request.headers.has('X-B151-Activity')).toBeFalse();
    req.flush(session(1800));
    advance(60_000);
    document.dispatchEvent(new Event('click'));
    idle.tick();
    http.expectNone(API);
  });

  it('never pings when the member is idle', () => {
    idle.start();
    advance(KEEPALIVE_MS + 60_000);
    idle.tick();
    http.expectNone(API);
  });

  it('"Stay signed in" sends a normal request and hides the warning', () => {
    idle.start();
    advance(28.5 * 60_000);
    idle.tick();
    http.expectOne(API).flush(session(90));
    idle.stayActive();
    expect(idle.warningSecondsLeft()).toBeNull();
    const req = http.expectOne(API);
    expect(req.request.headers.has('X-B151-Activity')).toBeFalse();
    req.flush(session(1800));
  });
});
