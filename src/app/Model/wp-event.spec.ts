import { GqlEvent, WpEvent, eventFromGraphql, formatEventDate, isExpired, parseEventDate, selectEvents } from './wp-event';

const ev = (id: number, publishedAt: string, startDate?: string, endDate?: string): WpEvent =>
  ({ id, slug: 'e' + id, title: 'Event ' + id, contentHtml: '', summary: '', publishedAt, startDate, endDate });

describe('wp-event', () => {
  it('parses the ACF date shapes WPGraphQL can return, keeping the calendar day', () => {
    expect(parseEventDate('20261115')).toBe('2026-11-15');
    expect(parseEventDate('2026-11-15')).toBe('2026-11-15');
    expect(parseEventDate('2026-11-15T00:00:00+00:00')).toBe('2026-11-15');
    expect(parseEventDate('11/15/2026')).toBe('2026-11-15');
    expect(parseEventDate('November 15, 2026')).toBe('2026-11-15');
    expect(parseEventDate('')).toBeUndefined();
    expect(parseEventDate(null)).toBeUndefined();
    expect(parseEventDate('20261341')).toBeUndefined();
  });

  it('maps a GraphQL event (without the ACF group) and builds a short summary', () => {
    const g: GqlEvent = {
      databaseId: 170, slug: 'got-skillz', title: 'GOT SKILLZ 6', date: '2026-11-01T13:05:22',
      content: '<p>' + Array(60).fill('word').join(' ') + '</p>',
      featuredImage: { node: { sourceUrl: 'https://x/flyer.jpg', altText: '', mediaDetails: { width: 1024, height: 409 } } },
    };
    const e = eventFromGraphql(g);
    expect(e).toEqual(jasmine.objectContaining({ id: 170, slug: 'got-skillz', title: 'GOT SKILLZ 6', publishedAt: '2026-11-01T13:05:22' }));
    expect(e.startDate).toBeUndefined();
    expect(e.image).toEqual({ url: 'https://x/flyer.jpg', alt: 'GOT SKILLZ 6', width: 1024, height: 409 });
    expect(e.summary.split(' ').length).toBe(40);
    expect(e.summary.endsWith('…')).toBeTrue();
  });

  it('reads date, end date, time and location from eventDetails', () => {
    const e = eventFromGraphql({
      databaseId: 1, slug: 's', title: 'T', date: '2026-11-01', content: '', featuredImage: null,
      eventDetails: { eventDate: '20261115', eventEndDate: '20261116', startTime: ' 6:00 pm ', location: 'Hampton, VA' },
    });
    expect([e.startDate, e.endDate, e.time, e.location]).toEqual(['2026-11-15', '2026-11-16', '6:00 pm', 'Hampton, VA']);
    expect(formatEventDate(e)).toBe('November 15 – November 16, 2026');
    expect(formatEventDate({ ...e, endDate: undefined })).toBe('Sunday, November 15, 2026');
  });

  it('expires an event after its last day; events without a date never expire', () => {
    const today = new Date(2026, 10, 15, 22, 0);   // Nov 15, 10 pm
    expect(isExpired(ev(1, '', '2026-11-15'), today)).toBeFalse();            // still today
    expect(isExpired(ev(1, '', '2026-11-14'), today)).toBeTrue();             // yesterday
    expect(isExpired(ev(1, '', '2026-11-14', '2026-11-16'), today)).toBeFalse(); // multi-day, still running
    expect(isExpired(ev(1, ''), today)).toBeFalse();                          // no date
  });

  it('features the newest current event and lists the others soonest first', () => {
    const now = new Date(2026, 10, 1);
    const sel = selectEvents([
      ev(1, '2026-10-01T00:00:00', '2026-12-20'),
      ev(2, '2026-10-30T00:00:00', '2026-11-20'),   // newest → featured
      ev(3, '2026-09-01T00:00:00', '2026-11-05'),
      ev(4, '2026-10-15T00:00:00', '2026-10-10'),   // expired
      ev(5, '2026-10-20T00:00:00'),                 // no date → last
    ], now);
    expect(sel.featured?.id).toBe(2);
    expect(sel.others.map(e => e.id)).toEqual([3, 1, 5]);
  });

  it('selects nothing when there are no events or all have expired', () => {
    const now = new Date(2026, 10, 1);
    expect(selectEvents([], now).featured).toBeUndefined();
    expect(selectEvents([ev(1, '2026-10-01', '2026-10-02')], now)).toEqual({ others: [] });
  });
});
