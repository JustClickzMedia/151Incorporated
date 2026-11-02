import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { PortalApiService } from '../../../Services/portal/portal-api.service';
import { DIRECTORY } from '../../../Services/portal/portal-queries';
import { PortalList, PortalMember } from '../../../Services/portal/portal.models';
import { Load, errorOf, loadState, readyData } from '../../../Services/portal/load-state';

/** /members/directory — active brothers, 25 per page, search by name. Contact details only when a brother shares them. */
@Component({
  selector: 'app-member-directory',
  templateUrl: './directory.component.html',
  styleUrls: ['../members-shared.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
})
export class MemberDirectoryComponent {
  private api = inject(PortalApiService);
  readonly pageSize = 25;
  readonly search = signal('');
  readonly page = signal(0);
  /** Searches only for 2+ letters (the server's rule); fewer letters show everyone. */
  private readonly query = computed(() => {
    const s = this.search().trim();
    return { first: this.pageSize, offset: this.page() * this.pageSize, search: s.length >= 2 ? s : null };
  });
  readonly state = toSignal(toObservable(this.query).pipe(
    debounceTime(300),
    distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
    switchMap(v => loadState(this.api.graphql<{ memberDirectory: PortalList<PortalMember> }>(DIRECTORY, v))),
  ), { initialValue: { status: 'loading' } as Load<{ memberDirectory: PortalList<PortalMember> }> });
  readonly data = computed(() => readyData(this.state())?.memberDirectory ?? null);
  readonly error = computed(() => errorOf(this.state()));

  onSearch(value: string): void { this.search.set(value); this.page.set(0); }
  pages(total: number): number { return Math.max(1, Math.ceil(total / this.pageSize)); }
}
