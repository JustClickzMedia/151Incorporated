import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PortalApiService, PortalError } from '../../../Services/portal/portal-api.service';
import { OAUTH_ERRORS } from '../../../Services/portal/portal.models';
import { safeReturn } from '../../../Services/portal/member.guard';
import { SeoService } from '../../../Services/seo.service';

/** /members/sign-in — email + password, Google/Microsoft buttons, and "forgot password". */
@Component({
  selector: 'app-sign-in',
  templateUrl: './sign-in.component.html',
  styleUrls: ['../members-shared.css', './sign-in.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink],
})
export class SignInComponent implements OnInit {
  private api = inject(PortalApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private seo = inject(SeoService);

  readonly mode = signal<'sign-in' | 'forgot'>('sign-in');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly adminSignInUrl = signal<string | null>(null);
  readonly providers = signal<{ id: string; label: string }[]>([]);

  readonly email = signal('');
  readonly password = signal('');

  ngOnInit(): void {
    this.seo.apply({ title: 'Member sign-in', noindex: true });
    const q = this.route.snapshot.queryParamMap;
    const err = q.get('error');
    if (err) { this.error.set(OAUTH_ERRORS[err] ?? 'Sign-in didn\'t work. Please try again.'); }
    const reason = q.get('reason');
    if (reason === 'idle') { this.notice.set('You were signed out after a period without activity. Please sign in again.'); }
    if (reason === 'signed-out') { this.notice.set('You\'re signed out.'); }
    this.api.providers().subscribe(p => this.providers.set(p));
  }

  private returnPath(): string { return safeReturn(this.route.snapshot.queryParamMap.get('return')); }

  submit(): void {
    if (this.busy()) { return; }
    this.error.set(null);
    this.adminSignInUrl.set(null);
    if (!this.email().trim() || !this.password()) { this.error.set('Enter your email address and password.'); return; }
    this.busy.set(true);
    this.api.signIn(this.email().trim(), this.password()).subscribe({
      next: () => {
        this.password.set('');
        this.busy.set(false);
        this.router.navigateByUrl(this.returnPath());
      },
      error: (e: PortalError) => {
        this.password.set('');
        this.busy.set(false);
        if (e.code === 'b151_use_admin_sign_in') { this.adminSignInUrl.set(e.signInUrl ?? null); }
        this.error.set(e.message);
      },
    });
  }

  startProvider(id: string): void {
    window.location.assign(this.api.oauthStartUrl(id, this.returnPath()));
  }

  showForgot(): void { this.mode.set('forgot'); this.error.set(null); this.notice.set(null); }
  showSignIn(): void { this.mode.set('sign-in'); this.error.set(null); }

  sendReset(): void {
    if (this.busy()) { return; }
    this.error.set(null);
    if (!/^\S+@\S+\.\S+$/.test(this.email().trim())) { this.error.set('Enter the email address on your member account.'); return; }
    this.busy.set(true);
    this.api.requestPasswordReset(this.email().trim()).subscribe({
      next: msg => { this.busy.set(false); this.notice.set(msg); this.mode.set('sign-in'); },
      error: (e: PortalError) => { this.busy.set(false); this.error.set(e.message); },
    });
  }
}
