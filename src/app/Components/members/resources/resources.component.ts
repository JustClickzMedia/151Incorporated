import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap, tap } from 'rxjs/operators';
import { PortalApiService } from '../../../Services/portal/portal-api.service';
import { RESOURCES } from '../../../Services/portal/portal-queries';
import { MemberResource, PortalList } from '../../../Services/portal/portal.models';
import { Load, errorOf, formatSize, loadState, readyData } from '../../../Services/portal/load-state';

/** /members/resources — documents, audio and video for members, grouped by category. Downloads are signed-in links. */
@Component({
  selector: 'app-member-resources',
  templateUrl: './resources.component.html',
  styleUrls: ['../members-shared.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberResourcesComponent {
  private api = inject(PortalApiService);
  readonly category = signal('');
  readonly categories = signal<string[]>([]);
  readonly state = toSignal(toObservable(this.category).pipe(
    switchMap(c => loadState(this.api.graphql<{ memberResources: PortalList<MemberResource> }>(RESOURCES, { first: 50, offset: 0, category: c || null }).pipe(
      // The unfiltered list decides which categories the menu offers.
      tap(r => { if (!c) { this.categories.set(this.categoriesOf(r.memberResources.nodes)); } }),
    ))),
  ), { initialValue: { status: 'loading' } as Load<{ memberResources: PortalList<MemberResource> }> });
  readonly data = computed(() => readyData(this.state())?.memberResources ?? null);
  readonly error = computed(() => errorOf(this.state()));
  private categoriesOf(nodes: MemberResource[]): string[] {
    return Array.from(new Set(nodes.map(r => r.category).filter((c): c is string => !!c))).sort();
  }
  readonly size = formatSize;

  kind(mime: string | null): string {
    if (!mime) { return ''; }
    if (mime.includes('pdf')) { return 'PDF'; }
    if (mime.startsWith('audio/')) { return 'Audio'; }
    if (mime.startsWith('video/')) { return 'Video'; }
    if (mime.startsWith('image/')) { return 'Image'; }
    if (mime.includes('word')) { return 'Word'; }
    if (mime.includes('sheet')) { return 'Excel'; }
    if (mime.includes('presentation')) { return 'PowerPoint'; }
    return 'File';
  }
}
