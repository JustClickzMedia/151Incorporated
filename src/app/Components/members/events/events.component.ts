import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs/operators';
import { PortalApiService } from '../../../Services/portal/portal-api.service';
import { EVENTS } from '../../../Services/portal/portal-queries';
import { MemberEvent, PortalList } from '../../../Services/portal/portal.models';
import { Load, errorOf, formatWhen, loadState, readyData } from '../../../Services/portal/load-state';

/** /members/events — upcoming member events (or past ones), 20 per page. */
@Component({
  selector: 'app-member-events',
  templateUrl: './events.component.html',
  styleUrls: ['../members-shared.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
})
export class MemberEventsComponent {
  private api = inject(PortalApiService);
  readonly pageSize = 20;
  readonly page = signal(0);
  readonly past = signal(false);
  private readonly query = computed(() => ({ first: this.pageSize, offset: this.page() * this.pageSize, includePast: this.past() }));
  readonly state = toSignal(toObservable(this.query).pipe(
    switchMap(v => loadState(this.api.graphql<{ memberEvents: PortalList<MemberEvent> }>(EVENTS, v))),
  ), { initialValue: { status: 'loading' } as Load<{ memberEvents: PortalList<MemberEvent> }> });
  readonly data = computed(() => readyData(this.state())?.memberEvents ?? null);
  readonly error = computed(() => errorOf(this.state()));
  readonly when = formatWhen;

  pages(total: number): number { return Math.max(1, Math.ceil(total / this.pageSize)); }

  setPast(on: boolean): void { this.past.set(on); this.page.set(0); }
}
