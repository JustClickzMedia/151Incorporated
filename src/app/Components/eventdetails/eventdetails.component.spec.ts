import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Title } from '@angular/platform-browser';
import { of } from 'rxjs';

import { EventdetailsComponent } from './eventdetails.component';
import { USE_GRAPHQL } from '../../Services/wordpress.service';
import { NOW } from '../../Model/now';
import { environment } from '../../../environments/environment';

describe('EventdetailsComponent (/event/:slug)', () => {
  let fixture: ComponentFixture<EventdetailsComponent>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  async function setup(slug: string, today = new Date(2026, 10, 1)) {
    await TestBed.configureTestingModule({
      imports: [EventdetailsComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
                  { provide: USE_GRAPHQL, useValue: true }, { provide: NOW, useValue: () => today },
                  { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ slug })) } }],
    }).compileComponents();
    fixture = TestBed.createComponent(EventdetailsComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }
  const request = (slug: string) =>
    http.expectOne(r => r.url === environment.graphqlUrl && r.body?.variables?.slug === slug);
  const render = async () => { fixture.detectChanges(); await fixture.whenStable(); };

  afterEach(() => http.verify());

  it('loads the event by slug and shows title, date, location, the full flyer and the description', async () => {
    await setup('got-skillz');
    request('got-skillz').flush({ data: { event: {
      databaseId: 170, slug: 'got-skillz', title: 'GOT SKILLZ 6', date: '2026-11-01T13:05:22',
      content: '<p>The cards are coming out.</p>',
      featuredImage: { node: { sourceUrl: 'https://img.test/flyer.jpg', altText: 'Flyer', mediaDetails: { width: 1024, height: 409 } } },
      eventDetails: { eventDate: '20261121', startTime: '6:00 pm', location: 'Hampton, VA', eventEndDate: null },
    } } });
    await render();
    expect(el().querySelector('h1')?.textContent).toContain('GOT SKILLZ 6');
    expect(el().querySelector('.meta')?.textContent).toContain('Saturday, November 21, 2026 · 6:00 pm');
    expect(el().querySelector('.meta')?.textContent).toContain('Hampton, VA');
    expect((el().querySelector('img.flyer') as HTMLImageElement).src).toBe('https://img.test/flyer.jpg');
    expect(el().querySelector('.content')?.textContent).toContain('The cards are coming out.');
    expect(el().querySelector('a.back')?.getAttribute('href')).toBe('/');
    expect(el().querySelector('.past-note')).toBeNull();
    expect(TestBed.inject(Title).getTitle()).toBe('GOT SKILLZ 6 | 1-5-1 Incorporated');
    // SEO: canonical address on the public site and schema.org Event data for Google's event results.
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://brothersof1-5-1.org/event/got-skillz');
    const ld = JSON.parse(document.head.querySelector('script[type="application/ld+json"]')!.textContent!);
    expect(ld[0]).toEqual(jasmine.objectContaining({ '@type': 'Event', name: 'GOT SKILLZ 6', startDate: '2026-11-21' }));
    expect(ld[0].location.name).toBe('Hampton, VA');
    expect(document.head.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe('https://img.test/flyer.jpg');
  });

  it('notes when the event has already taken place', async () => {
    await setup('old', new Date(2026, 11, 1));
    request('old').flush({ data: { event: { databaseId: 1, slug: 'old', title: 'Old', date: '2026-10-01', content: '', featuredImage: null,
      eventDetails: { eventDate: '20261101' } } } });
    await render();
    expect(el().querySelector('.past-note')?.textContent).toContain('already taken place');
  });

  it('shows the 404 view for an unknown slug', async () => {
    await setup('nope');
    request('nope').flush({ data: { event: null } });
    await render();
    expect(el().querySelector('app-pagenotfound')).not.toBeNull();
  });

  it('shows a friendly message (and logs) when WordPress fails', async () => {
    spyOn(console, 'error');
    await setup('x');
    request('x').flush({}, { status: 500, statusText: 'Server Error' });
    await render();
    expect(el().textContent).toContain("couldn't be loaded");
    expect(console.error).toHaveBeenCalled();
  });
});
