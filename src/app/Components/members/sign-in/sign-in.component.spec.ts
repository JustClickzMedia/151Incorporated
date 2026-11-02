import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { SignInComponent } from './sign-in.component';
import { PORTAL_CONFIG } from '../../../Services/portal/portal-api.service';

const API = 'https://wp.test/wp-json/b151/v1';

describe('SignInComponent', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  const el = () => harness.routeNativeElement as HTMLElement;

  async function open(url = '/members/sign-in') {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(),
        { provide: PORTAL_CONFIG, useValue: { apiUrl: 'https://wp.test', graphqlUrl: 'https://wp.test/graphql' } },
        provideRouter([{ path: 'members/sign-in', component: SignInComponent }, { path: '**', children: [] }])],
    });
    harness = await RouterTestingHarness.create();
    http = TestBed.inject(HttpTestingController);
    await harness.navigateByUrl(url);
    http.expectOne(`${API}/oauth/providers`).flush({ providers: [{ id: 'google', label: 'Google' }] });
    harness.detectChanges();
    await harness.fixture.whenStable();
  }

  function type(selector: string, value: string) {
    const input = el().querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    harness.detectChanges(); // as in the browser, typing triggers change detection
  }

  it('signs in and goes to the requested member page', async () => {
    await open('/members/sign-in?return=%2Fmembers%2Fevents');
    type('#email', 'b@test');
    type('#password', 'a long password');
    (el().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    const req = http.expectOne(`${API}/session`);
    expect(req.request.body).toEqual({ username: 'b@test', password: 'a long password' });
    req.flush({ authenticated: true, nonce: 'n', member: { id: 1, display_name: 'B' }, idle_seconds_remaining: 1800,
      idle_limit_seconds: 1800, warning_seconds: 120, expires_at: null, admin_session: false }, { status: 201, statusText: 'Created' });
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/members/events');
  });

  it('shows the server message and clears the password on failure', async () => {
    await open();
    type('#email', 'b@test');
    type('#password', 'wrong password');
    (el().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    http.expectOne(`${API}/session`).flush({ code: 'b151_invalid_login', message: 'The email or password is not correct, or this account is not active yet.' },
      { status: 401, statusText: 'Unauthorized' });
    harness.detectChanges();
    expect(el().querySelector('[role=alert]')?.textContent).toContain('not correct');
    await new Promise(r => setTimeout(r)); // ngModel writes the cleared value to the input on the next microtask
    expect((el().querySelector('#password') as HTMLInputElement).value).toBe('');
  });

  it('explains Google/Microsoft errors and idle sign-outs', async () => {
    await open('/members/sign-in?error=no_account&reason=idle');
    expect(el().textContent).toContain('No member account uses that address');
    expect(el().textContent).toContain('signed out after a period without activity');
    expect(el().textContent).toContain('Sign in with Google');
  });

  it('sends a reset link from "Forgot your password?"', async () => {
    await open();
    (Array.from(el().querySelectorAll('button')).find(b => b.textContent?.includes('Forgot')) as HTMLButtonElement).click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    type('#reset-email', 'b@test.org');
    (el().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    http.expectOne(`${API}/session/password-reset`).flush({ message: 'If that address belongs to an active member, a reset link is on its way.' }, { status: 202, statusText: 'Accepted' });
    harness.detectChanges();
    expect(el().textContent).toContain('a reset link is on its way');
  });
});
