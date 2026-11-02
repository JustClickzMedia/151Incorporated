import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs/operators';
import { DatePipe } from '@angular/common';
import { PortalApiService } from '../../../Services/portal/portal-api.service';
import { ANNOUNCEMENTS } from '../../../Services/portal/portal-queries';
import { Announcement, PortalList } from '../../../Services/portal/portal.models';
import { Load, errorOf, loadState, readyData } from '../../../Services/portal/load-state';

/** /members/announcements — pinned first, then newest; expired ones are hidden by the server. */
@Component({
  selector: 'app-member-announcements',
  templateUrl: './announcements.component.html',
  styleUrls: ['../members-shared.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
})
export class MemberAnnouncementsComponent {
  private api = inject(PortalApiService);
  readonly pageSize = 20;
  readonly page = signal(0);
  readonly state = toSignal(toObservable(this.page).pipe(
    switchMap(p => loadState(this.api.graphql<{ memberAnnouncements: PortalList<Announcement> }>(ANNOUNCEMENTS, { first: this.pageSize, offset: p * this.pageSize }))),
  ), { initialValue: { status: 'loading' } as Load<{ memberAnnouncements: PortalList<Announcement> }> });
  readonly data = computed(() => readyData(this.state())?.memberAnnouncements ?? null);
  readonly error = computed(() => errorOf(this.state()));
  pages(total: number): number { return Math.max(1, Math.ceil(total / this.pageSize)); }
}
