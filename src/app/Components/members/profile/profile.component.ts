import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PortalApiService, PortalError } from '../../../Services/portal/portal-api.service';
import { MY_PROFILE, SAVE_PROFILE } from '../../../Services/portal/portal-queries';
import { PortalMember, SHAREABLE_FIELDS, Visibility } from '../../../Services/portal/portal.models';
import { messageOf } from '../../../Services/portal/load-state';
import { MIN_PASSWORD } from '../reset-password/reset-password.component';

type ProfileForm = Record<'displayName' | 'phone' | 'address1' | 'address2' | 'city' | 'state' | 'postalCode' | 'joinedYear' | 'line' | 'bio', string>;
const FORM_FIELDS: (keyof ProfileForm)[] = ['displayName', 'phone', 'address1', 'address2', 'city', 'state', 'postalCode', 'joinedYear', 'line', 'bio'];

/** /members/profile — edit my details, choose what other brothers can see, change password, link Google/Microsoft. */
@Component({
  selector: 'app-member-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['../members-shared.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
})
export class ProfileComponent implements OnInit {
  private api = inject(PortalApiService);

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly me = signal<PortalMember | null>(null);
  readonly saving = signal(false);
  readonly saved = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);
  readonly shareable = SHAREABLE_FIELDS;
  readonly providers = signal<{ id: string; label: string }[]>([]);

  form: ProfileForm = { displayName: '', phone: '', address1: '', address2: '', city: '', state: '', postalCode: '', joinedYear: '', line: '', bio: '' };
  sharing: Record<string, boolean> = {};

  // Change password
  current = '';
  next = '';
  confirm = '';
  readonly pwBusy = signal(false);
  readonly pwError = signal<string | null>(null);
  readonly pwDone = signal(false);

  ngOnInit(): void {
    this.api.graphql<{ currentMember: PortalMember | null; myMemberVisibility: Visibility[] }>(MY_PROFILE).subscribe({
      next: d => { this.fill(d.currentMember, d.myMemberVisibility); this.loading.set(false); },
      error: e => { this.loadError.set(messageOf(e)); this.loading.set(false); },
    });
    this.api.providers().subscribe(p => this.providers.set(p));
  }

  private fill(m: PortalMember | null, vis: Visibility[]): void {
    this.me.set(m);
    if (m) {
      for (const f of FORM_FIELDS) { this.form[f] = (m[f] as string | null) ?? ''; }
    }
    this.sharing = Object.fromEntries(SHAREABLE_FIELDS.map(s => [s.field, vis.find(v => v.field === s.field)?.audience === 'members']));
  }

  save(): void {
    if (this.saving()) { return; }
    this.saved.set(null);
    this.saveError.set(null);
    if (!this.form.displayName.trim()) { this.saveError.set('Your name can\'t be empty.'); return; }
    if (this.form.joinedYear && !/^(19|20)\d{2}$/.test(this.form.joinedYear.trim())) { this.saveError.set('Year must look like 1982.'); return; }
    const input = {
      ...Object.fromEntries(FORM_FIELDS.map(f => [f, this.form[f].trim()])),
      visibility: SHAREABLE_FIELDS.map(s => ({ field: s.field, audience: this.sharing[s.field] ? 'members' : 'admins' })),
    };
    this.saving.set(true);
    this.api.graphql<{ updateMyMemberProfile: { member: PortalMember } }>(SAVE_PROFILE, { input }).subscribe({
      next: d => {
        this.saving.set(false);
        this.me.set(d.updateMyMemberProfile.member);
        this.saved.set('Your profile is saved.');
        this.api.refresh(false).subscribe({ error: () => {} }); // updates the name in the welcome bar
      },
      error: e => { this.saving.set(false); this.saveError.set(messageOf(e)); },
    });
  }

  changePassword(): void {
    if (this.pwBusy()) { return; }
    this.pwError.set(null);
    this.pwDone.set(false);
    if (!this.current) { this.pwError.set('Enter your current password.'); return; }
    if (this.next.length < MIN_PASSWORD) { this.pwError.set(`Use at least ${MIN_PASSWORD} characters.`); return; }
    if (this.next !== this.confirm) { this.pwError.set('The two new passwords don\'t match.'); return; }
    this.pwBusy.set(true);
    this.api.changePassword(this.current, this.next).subscribe({
      next: () => { this.pwBusy.set(false); this.current = this.next = this.confirm = ''; this.pwDone.set(true); },
      error: (e: PortalError) => { this.pwBusy.set(false); this.pwError.set(e.message); },
    });
  }

  linkUrl(provider: string): string { return this.api.oauthStartUrl(provider, '/members/profile', true); }
}
