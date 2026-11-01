import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { WordpressService } from '../../Services/wordpress.service';
import { SeoService } from '../../Services/seo.service';
import { PagenotfoundComponent } from '../pagenotfound/pagenotfound.component';
import { WpEvent, formatEventDate, isExpired } from '../../Model/wp-event';
import { NOW } from '../../Model/now';

type EventState =
  | { status: 'loading' }
  | { status: 'found'; event: WpEvent }
  | { status: 'notfound' }
  | { status: 'error' };

/** One event's page: /event/<slug>. Shows the full flyer image (uncropped), date, time, location and description. */
@Component({
  selector: 'app-eventdetails',
  templateUrl: './eventdetails.component.html',
  styleUrls: ['./eventdetails.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PagenotfoundComponent],
})
export class EventdetailsComponent {
  private route = inject(ActivatedRoute);
  private wp = inject(WordpressService);
  private seo = inject(SeoService);
  private now = inject(NOW);

  readonly state = toSignal(this.route.paramMap.pipe(
    map(p => (p.get('slug') ?? '').trim()),
    switchMap(slug => this.load(slug)),
    tap(s => { if (s.status === 'found') { this.applySeo(s.event); } })
  ), { initialValue: { status: 'loading' } as EventState });

  readonly event = computed(() => { const s = this.state(); return s.status === 'found' ? s.event : undefined; });
  readonly notFound = computed(() => this.state().status === 'notfound');
  readonly failed = computed(() => this.state().status === 'error');
  readonly loading = computed(() => this.state().status === 'loading');
  readonly dateLabel = computed(() => { const e = this.event(); return e ? formatEventDate(e) : undefined; });
  /** Past events stay reachable by link, but say so. */
  readonly past = computed(() => { const e = this.event(); return !!e && isExpired(e, this.now()); });

  private load(slug: string): Observable<EventState> {
    if (!slug) { return of({ status: 'notfound' }); }
    return this.wp.getEventBySlug(slug).pipe(
      map((event): EventState => event ? { status: 'found', event } : { status: 'notfound' }),
      catchError(err => { console.error(err); return of<EventState>({ status: 'error' }); })
    );
  }

  private applySeo(event: WpEvent): void {
    try {
      this.seo.removeMetaTags();
      this.seo.addMetaTags();
      this.seo.setTitle(event.title);
      if (event.summary) { this.seo.updateDescMetaTags(event.summary); }
    } catch (err) {
      console.error(err);
    }
  }
}
