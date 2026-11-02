import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs/operators';
import { PortalApiService } from '../../../Services/portal/portal-api.service';
import { BROTHER } from '../../../Services/portal/portal-queries';
import { PortalMember } from '../../../Services/portal/portal.models';
import { Load, errorOf, loadState, readyData } from '../../../Services/portal/load-state';

/** /members/directory/:id — one brother, showing only what he shares. */
@Component({
  selector: 'app-member-brother',
  templateUrl: './brother.component.html',
  styleUrls: ['../members-shared.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
})
export class BrotherComponent {
  private api = inject(PortalApiService);
  private route = inject(ActivatedRoute);
  readonly state = toSignal(this.route.paramMap.pipe(
    map(p => Number(p.get('id')) || 0),
    switchMap(id => loadState(this.api.graphql<{ memberProfile: PortalMember | null }>(BROTHER, { id }))),
  ), { initialValue: { status: 'loading' } as Load<{ memberProfile: PortalMember | null }> });
  readonly ready = computed(() => readyData(this.state()));
  readonly brother = computed(() => this.ready()?.memberProfile ?? null);
  readonly error = computed(() => errorOf(this.state()));
  readonly address = computed(() => {
    const b = this.brother();
    if (!b) { return ''; }
    const cityLine = [b.city, [b.state, b.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    return [b.address1, b.address2, cityLine].filter(Boolean).join('\n');
  });
}
