import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PortalApiService, PortalError } from '../../../Services/portal/portal-api.service';
import { SeoService } from '../../../Services/seo.service';

export const MIN_PASSWORD = 12;

/** /members/reset-password?login=…&key=… — the link from the reset email. */
@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['../members-shared.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink],
})
export class ResetPasswordComponent implements OnInit {
  private api = inject(PortalApiService);
  private route = inject(ActivatedRoute);
  private seo = inject(SeoService);

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly done = signal<string | null>(null);
  readonly linkMissing = signal(false);
  readonly min = MIN_PASSWORD;

  password = '';
  confirm = '';
  private login = '';
  private key = '';

  ngOnInit(): void {
    this.seo.apply({ title: 'Choose a new password', noindex: true });
    const q = this.route.snapshot.queryParamMap;
    this.login = q.get('login') ?? '';
    this.key = q.get('key') ?? '';
    this.linkMissing.set(!this.login || !this.key);
  }

  submit(): void {
    if (this.busy()) { return; }
    this.error.set(null);
    if (this.password.length < MIN_PASSWORD) { this.error.set(`Use at least ${MIN_PASSWORD} characters.`); return; }
    if (this.password !== this.confirm) { this.error.set('The two passwords don\'t match.'); return; }
    this.busy.set(true);
    this.api.confirmPasswordReset(this.login, this.key, this.password).subscribe({
      next: msg => { this.busy.set(false); this.password = this.confirm = ''; this.done.set(msg); },
      error: (e: PortalError) => { this.busy.set(false); this.error.set(e.message); },
    });
  }
}
