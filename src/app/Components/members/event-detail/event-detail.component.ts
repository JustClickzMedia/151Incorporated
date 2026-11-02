import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs/operators';
import { PortalApiService } from '../../../Services/portal/portal-api.service';
import { EVENT } from '../../../Services/portal/portal-queries';
import { MemberEvent } from '../../../Services/portal/portal.models';
import { Load, errorOf, formatWhen, loadState, readyData } from '../../../Services/portal/load-state';

/** /members/events/:id — one member event, including the meeting link for those allowed to see it. */
@Component({
  selector: 'app-member-event-detail',
  templateUrl: './event-detail.component.html',
  styleUrls: ['../members-shared.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
})
export class MemberEventDetailComponent {
  private api = inject(PortalApiService);
  private route = inject(ActivatedRoute);
  readonly state = toSignal(this.route.paramMap.pipe(
    map(p => Number(p.get('id')) || 0),
    switchMap(id => loadState(this.api.graphql<{ memberEvent: MemberEvent | null }>(EVENT, { id }))),
  ), { initialValue: { status: 'loading' } as Load<{ memberEvent: MemberEvent | null }> });
  readonly ready = computed(() => readyData(this.state()));
  readonly event = computed(() => this.ready()?.memberEvent ?? null);
  readonly error = computed(() => errorOf(this.state()));
  readonly when = formatWhen;
}
