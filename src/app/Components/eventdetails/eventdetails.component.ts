import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { WordpressService } from '../../Services/wordpress.service';
import { SeoService, breadcrumbLd } from '../../Services/seo.service';
import { SITE, metaText, siteUrl } from '../../Services/seo.config';
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
      const path = '/event/' + event.slug;
      const title = metaText(event.title, 120);
      const when = formatEventDate(event);
      const description = [when, event.location, event.summary].filter(Boolean).join(' · ');
      const jsonLd: object[] = [
        breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Events', path: '/events' }, { name: title, path }]),
      ];
      // Google's event results need a date and a place; only describe the event as an Event when both exist.
      if (event.startDate && event.location) {
        jsonLd.unshift({
          '@context': 'https://schema.org',
          '@type': 'Event',
          name: title,
          description: metaText(event.summary, 300),
          startDate: event.startDate,
          endDate: event.endDate ?? event.startDate,
          eventStatus: 'https://schema.org/EventScheduled',
          eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
          location: { '@type': 'Place', name: event.location, address: event.location },
          image: event.image ? [event.image.url] : undefined,
          url: siteUrl(path),
          organizer: { '@type': 'Organization', name: SITE.name, url: SITE.url + '/' },
        });
      }
      this.seo.apply({ title, description, path, image: event.image, jsonLd });
    } catch (err) {
      console.error(err);
    }
  }
}
