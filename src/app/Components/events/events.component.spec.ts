import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { EventsComponent } from './events.component';
import { USE_GRAPHQL } from '../../Services/wordpress.service';
import { NOW } from '../../Model/now';
import { environment } from '../../../environments/environment';

const TODAY = new Date(2026, 10, 1, 12, 0);   // Nov 1, 2026

const node = (id: number, date: string, extra: Record<string, unknown> = {}) => ({
  databaseId: id, slug: 'event-' + id, title: 'Event ' + id, date, content: '<p>Description of event ' + id + '</p>',
  featuredImage: { node: { sourceUrl: 'https://img.test/' + id + '.jpg', altText: '', mediaDetails: { width: 1024, height: 409 } } },
  ...extra,
});

describe('EventsComponent (homepage Upcoming Events)', () => {
  let fixture: ComponentFixture<EventsComponent>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventsComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
                  { provide: USE_GRAPHQL, useValue: true }, { provide: NOW, useValue: () => TODAY }],
    }).compileComponents();
    fixture = TestBed.createComponent(EventsComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const eventsRequest = () => http.expectOne(r => r.url === environment.graphqlUrl && /events\(/.test(r.body?.query));
  const respond = async (nodes: unknown[]) => {
    eventsRequest().flush({ data: { events: { nodes } } });
    fixture.detectChanges();
    await fixture.whenStable();
  };

  it('is not shown when there are no events', async () => {
    await respond([]);
    expect(el().querySelector('section.events')).toBeNull();
  });

  it('is not shown when every event has expired', async () => {
    await respond([node(1, '2026-10-01T00:00:00', { eventDetails: { eventDate: '20261015' } })]);
    expect(el().querySelector('section.events')).toBeNull();
  });

  it('is not shown (and logs) when WordPress fails', async () => {
    spyOn(console, 'error');
    eventsRequest().flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(el().querySelector('section.events')).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it('one event: two columns, its picture and its description, both linking to the event page', async () => {
    await respond([node(170, '2026-11-01T13:05:22')]);
    const cols = el().querySelectorAll('section.events .row > div');
    expect(cols.length).toBe(2);
    expect((cols[0].querySelector('img') as HTMLImageElement).src).toBe('https://img.test/170.jpg');
    expect(cols[0].querySelector('a')?.getAttribute('href')).toBe('/event/event-170');
    expect(cols[1].querySelector('.description h3')?.textContent).toContain('Event 170');
    expect(cols[1].textContent).toContain('Description of event 170');
    expect(cols[1].querySelector('a.details-link')?.getAttribute('href')).toBe('/event/event-170');
    expect(el().querySelector('.event-list')).toBeNull();
  });

  it('several events: the newest event is the advertisement, the others are listed soonest first, all linked', async () => {
    await respond([
      node(1, '2026-10-01T00:00:00', { eventDetails: { eventDate: '20261220', location: 'Chicago, IL' } }),
      node(2, '2026-10-30T00:00:00', { eventDetails: { eventDate: '20261121' } }),
      node(3, '2026-09-01T00:00:00', { eventDetails: { eventDate: '20261105' } }),
    ]);
    const cols = el().querySelectorAll('section.events .row > div');
    expect((cols[0].querySelector('img.featured-img') as HTMLImageElement).src).toBe('https://img.test/2.jpg');
    expect(cols[0].querySelector('.featured-caption')?.textContent).toContain('Saturday, November 21, 2026');
    const items = Array.from(cols[1].querySelectorAll('.event-list a.event-item'));
    expect(items.map(a => a.querySelector('.item-title')?.textContent)).toEqual(['Event 3', 'Event 1']);
    expect(items.map(a => a.getAttribute('href'))).toEqual(['/event/event-3', '/event/event-1']);
    expect(items[0].querySelector('.badge-date')?.textContent?.replace(/\s/g, '')).toBe('NOV5');
    expect(items[1].textContent).toContain('Chicago, IL');
    expect(cols[1].querySelector('.description')).toBeNull();
  });

  it('works before the ACF "eventDetails" group exists in WordPress (retries without it)', async () => {
    eventsRequest().flush({ errors: [{ message: 'Cannot query field "eventDetails" on type "Event".' }] });
    const basic = eventsRequest();
    expect(basic.request.body.query).not.toContain('eventDetails');
    basic.flush({ data: { events: { nodes: [node(170, '2026-11-01T13:05:22')] } } });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el().querySelector('section.events .description h3')?.textContent).toContain('Event 170');
  });
});
