import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PortalApiService } from '../../../Services/portal/portal-api.service';
import { IdleService } from '../../../Services/portal/idle.service';
import { SeoService } from '../../../Services/seo.service';

/** Frame of the signed-in member area: welcome bar, member menu, idle warning, then the page. */
@Component({
  selector: 'app-members-layout',
  templateUrl: './members-layout.component.html',
  styleUrls: ['../members-shared.css', './members-layout.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
})
export class MembersLayoutComponent implements OnInit {
  readonly api = inject(PortalApiService);
  readonly idle = inject(IdleService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private seo = inject(SeoService);

  readonly name = computed(() => this.api.member()?.display_name ?? '');
  readonly number = computed(() => this.api.member()?.membership_number ?? '');
  readonly warningMinutes = computed(() => {
    const s = this.idle.warningSecondsLeft();
    return s === null ? null : Math.max(1, Math.ceil(s / 60));
  });

  ngOnInit(): void {
    this.seo.apply({ title: 'Member area', noindex: true });
    this.idle.start(this.destroyRef);
  }

  signOut(): void {
    this.idle.stop();
    this.api.signOut().subscribe(() => this.router.navigate(['/members/sign-in'], { queryParams: { reason: 'signed-out' } }));
  }
}
