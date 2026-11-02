import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { PortalApiService } from '../../../Services/portal/portal-api.service';
import { DASHBOARD } from '../../../Services/portal/portal-queries';
import { Announcement, MemberEvent, PortalList } from '../../../Services/portal/portal.models';
import { Load, errorOf, formatWhen, loadState, readyData } from '../../../Services/portal/load-state';

interface DashboardData { memberAnnouncements: PortalList<Announcement>; memberEvents: PortalList<MemberEvent> }

const CLASSIFICATIONS: Record<string, string> = { member: 'Member', life_member: 'Life Member', honorary: 'Honorary Member' };

/** /members — welcome, membership details, latest announcements and next events. */
@Component({
  selector: 'app-members-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['../members-shared.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
})
export class DashboardComponent {
  private api = inject(PortalApiService);
  readonly member = this.api.member;
  readonly classification = computed(() => CLASSIFICATIONS[this.member()?.classification ?? ''] ?? '');
  readonly state = toSignal(loadState(this.api.graphql<DashboardData>(DASHBOARD)), { initialValue: { status: 'loading' } as Load<DashboardData> });
  readonly data = computed(() => readyData(this.state()));
  readonly error = computed(() => errorOf(this.state()));
  readonly when = formatWhen;
}
