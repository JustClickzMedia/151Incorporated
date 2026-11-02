import { Component, ChangeDetectionStrategy, DOCUMENT, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { WordpressService } from '../../Services/wordpress.service';
import { SeoService, breadcrumbLd } from '../../Services/seo.service';
import { WpEvent, eventBadge, formatEventDate, upcomingEvents } from '../../Model/wp-event';
import { NOW } from '../../Model/now';

export type EventsView = 'list' | 'grid';
/** The visitor's last choice of list/grid, remembered in this browser. */
export const EVENTS_VIEW_KEY = 'bo151.eventsView';

type ListState = { status: 'loading' } | { status: 'ready'; events: WpEvent[] } | { status: 'error' };

/**
 * Events page (/events, menu UPDATE → Events): every current event from WordPress, with a List / Grid toggle.
 * Each event (picture, title, button — the whole row or card) opens its event page (/event/<slug>).
 * No current events → a "no new events" message.
 */
@Component({
  selector: 'app-eventslist',
  templateUrl: './eventslist.component.html',
  styleUrls: ['./eventslist.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
})
export class EventslistComponent {
  private wp = inject(WordpressService);
  private now = inject(NOW);
  private storage = inject(DOCUMENT).defaultView?.localStorage;

  readonly state = toSignal(
    this.wp.getEvents().pipe(
      map((events): ListState => ({ status: 'ready', events })),
      catchError(err => { console.error(err); return of<ListState>({ status: 'error' }); })
    ),
    { initialValue: { status: 'loading' } as ListState }
  );

  readonly events = computed(() => { const s = this.state(); return s.status === 'ready' ? upcomingEvents(s.events, this.now()) : []; });
  readonly loading = computed(() => this.state().status === 'loading');
  readonly failed = computed(() => this.state().status === 'error');
  readonly empty = computed(() => this.state().status === 'ready' && this.events().length === 0);

  readonly view = signal<EventsView>(this.savedView());

  constructor() {
    const seo = inject(SeoService);
    seo.apply({
      title: 'Events',
      description: 'Upcoming events from The Brothers of 1-5-1, Incorporated.',
      path: '/events',
      jsonLd: breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Events', path: '/events' }]),
    });
  }

  setView(view: EventsView) {
    this.view.set(view);
    try { this.storage?.setItem(EVENTS_VIEW_KEY, view); } catch { /* private mode etc.: just don't remember */ }
  }

  dateLabel(event: WpEvent) { return formatEventDate(event); }
  badge(event: WpEvent) { return eventBadge(event); }

  private savedView(): EventsView {
    try { return this.storage?.getItem(EVENTS_VIEW_KEY) === 'grid' ? 'grid' : 'list'; } catch { return 'list'; }
  }
}
