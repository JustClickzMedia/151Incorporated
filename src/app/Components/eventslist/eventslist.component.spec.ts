import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Title } from '@angular/platform-browser';

import { EVENTS_VIEW_KEY, EventslistComponent } from './eventslist.component';
import { USE_GRAPHQL } from '../../Services/wordpress.service';
import { NOW } from '../../Model/now';
import { environment } from '../../../environments/environment';

const node = (id: number, date: string, eventDate?: string, image = true) => ({
  databaseId: id, slug: 'event-' + id, title: 'Event ' + id, date, content: '<p>About event ' + id + '</p>',
  featuredImage: image ? { node: { sourceUrl: 'https://img.test/' + id + '.jpg', altText: '', mediaDetails: null } } : null,
  eventDetails: eventDate ? { eventDate, location: 'Hampton, VA' } : null,
});

describe('EventslistComponent (/events)', () => {
  let fixture: ComponentFixture<EventslistComponent>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    localStorage.removeItem(EVENTS_VIEW_KEY);
    await TestBed.configureTestingModule({
      imports: [EventslistComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
                  { provide: USE_GRAPHQL, useValue: true }, { provide: NOW, useValue: () => new Date(2026, 10, 1) }],
    }).compileComponents();
    fixture = TestBed.createComponent(EventslistComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => { http.verify(); localStorage.removeItem(EVENTS_VIEW_KEY); });

  const respond = async (nodes: unknown[]) => {
    http.expectOne(r => r.url === environment.graphqlUrl && /events\(/.test(r.body?.query)).flush({ data: { events: { nodes } } });
    fixture.detectChanges();
    await fixture.whenStable();
  };

  it('says there are no new events (and hides the toggle) when there are none or all have expired', async () => {
    expect(el().textContent).toContain('Loading events');
    await respond([node(1, '2026-09-01', '20261001')]);
    expect(el().querySelector('.no-events h2')?.textContent).toContain('There are no new events at this time.');
    expect(el().querySelector('.view-toggle')).toBeNull();
    expect(TestBed.inject(Title).getTitle()).toBe('Events | 1-5-1 Incorporated');
  });

  it('shows current events as a list by default, soonest first, every row linking to its event page', async () => {
    await respond([node(1, '2026-10-01', '20261220'), node(2, '2026-10-30', '20261121'), node(3, '2026-09-01', '20261001'), node(4, '2026-10-20', undefined, false)]);
    const rows = Array.from(el().querySelectorAll('.event-rows a.event-row'));
    expect(rows.map(a => a.querySelector('.title')?.textContent)).toEqual(['Event 2', 'Event 1', 'Event 4']);   // 3 expired
    expect(rows.map(a => a.getAttribute('href'))).toEqual(['/event/event-2', '/event/event-1', '/event/event-4']);
    expect(rows[0].textContent).toContain('Saturday, November 21, 2026');
    expect(rows[0].textContent).toContain('About event 2');
    expect(el().querySelector('.event-grid')).toBeNull();
    const [listBtn, gridBtn] = Array.from(el().querySelectorAll('.view-toggle button'));
    expect(listBtn.getAttribute('aria-pressed')).toBe('true');
    expect(gridBtn.getAttribute('aria-pressed')).toBe('false');
  });

  it('switches to the grid view (cards, each linking to its event page) and remembers the choice', async () => {
    await respond([node(1, '2026-10-01', '20261220'), node(2, '2026-10-30', '20261121')]);
    (el().querySelectorAll('.view-toggle button')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    const cards = Array.from(el().querySelectorAll('.event-grid a.event-card'));
    expect(cards.map(a => a.getAttribute('href'))).toEqual(['/event/event-2', '/event/event-1']);
    expect(el().querySelector('.event-rows')).toBeNull();
    expect(localStorage.getItem(EVENTS_VIEW_KEY)).toBe('grid');

    (el().querySelectorAll('.view-toggle button')[0] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el().querySelector('.event-rows')).not.toBeNull();
    expect(localStorage.getItem(EVENTS_VIEW_KEY)).toBe('list');
  });

  it('shows a friendly message (and logs) when WordPress fails', async () => {
    spyOn(console, 'error');
    http.expectOne(r => r.url === environment.graphqlUrl).flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(el().textContent).toContain("couldn't be loaded");
    expect(console.error).toHaveBeenCalled();
  });
});
