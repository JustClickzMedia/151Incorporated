import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { WordpressService } from '../../Services/wordpress.service';
import { WpEvent, eventBadge, formatEventDate, selectEvents } from '../../Model/wp-event';
import { NOW } from '../../Model/now';

/**
 * Homepage "Upcoming Events" section, from the WordPress Events post type.
 *   - no current events (none, or all expired): the section isn't shown at all
 *   - one current event: its picture beside its description
 *   - several: the newest event's picture as the advertisement, beside a list of the other upcoming events
 * Each event links to its own page (/event/<slug>).
 */
@Component({
  selector: 'app-events',
  templateUrl: './events.component.html',
  styleUrls: ['./events.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
})
export class EventsComponent {
  private wp = inject(WordpressService);
  private now = inject(NOW);

  private readonly events = toSignal(
    this.wp.getEvents().pipe(catchError(err => { console.error(err); return of<WpEvent[]>([]); })),
    { initialValue: [] as WpEvent[] }
  );

  readonly selection = computed(() => selectEvents(this.events(), this.now()));
  readonly featured = computed(() => this.selection().featured);
  readonly others = computed(() => this.selection().others);

  dateLabel(event: WpEvent) { return formatEventDate(event); }
  badge(event: WpEvent) { return eventBadge(event); }
}
