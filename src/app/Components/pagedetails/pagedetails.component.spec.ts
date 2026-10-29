import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { Title } from '@angular/platform-browser';
import { BehaviorSubject } from 'rxjs';

import { PagedetailsComponent } from './pagedetails.component';
import { environment } from '../../../environments/environment';

describe('PagedetailsComponent', () => {
  let fixture: ComponentFixture<PagedetailsComponent>;
  let http: HttpTestingController;
  let params: BehaviorSubject<ParamMap>;

  const item = (id: number, slug: string, title: string, withImage = true) => ({
    id, slug, date: '2026-01-02T10:00:00',
    title: { rendered: title }, content: { rendered: '<p>Body ' + id + '</p>' },
    _embedded: withImage ? { 'wp:featuredmedia': [{ media_details: { sizes: { full: { source_url: 'https://example.test/img.jpg' } } } }] } : {},
    'post-custom-fields': { Keywords: 'k', Description: 'd' },
  });

  const pageBySlug = (slug: string): TestRequest =>
    http.expectOne(r => r.url === environment.restUrl + 'pages' && r.params.get('slug') === slug && r.params.has('_embed'));

  /** The sidebar requests posts too; flush those so verify() only checks what this spec cares about. */
  const flushSidebar = () =>
    http.match(r => r.url === environment.restUrl + 'posts?_embed').forEach(r => r.flush([]));

  const el = () => fixture.nativeElement as HTMLElement;
  const render = async () => { fixture.detectChanges(); await fixture.whenStable(); };

  async function setup(slug: string) {
    params = new BehaviorSubject<ParamMap>(convertToParamMap({ slug }));
    await TestBed.configureTestingModule({
      imports: [PagedetailsComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: params.asObservable() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PagedetailsComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }

  afterEach(() => { flushSidebar(); http.verify(); });

  it('loads the page for the route slug once and renders it', async () => {
    await setup('about-1-5-1');
    pageBySlug('about-1-5-1').flush([item(19, 'about-1-5-1', '1-5-1 History')]);
    await render();
    expect(el().textContent).toContain('1-5-1 History');
    expect(el().querySelector('app-pagenotfound')).toBeNull();
    expect(TestBed.inject(Title).getTitle()).toBe('1-5-1 History');
  });

  it('re-fetches when the route slug changes', async () => {
    await setup('about-1-5-1');
    pageBySlug('about-1-5-1').flush([item(19, 'about-1-5-1', '1-5-1 History')]);
    params.next(convertToParamMap({ slug: 'membership' }));
    pageBySlug('membership').flush([item(29, 'membership', 'Membership Requirement')]);
    await render();
    expect(el().textContent).toContain('Membership Requirement');
  });

  it('shows the 404 view when no page has that slug', async () => {
    await setup('no-such-page');
    pageBySlug('no-such-page').flush([]);
    await render();
    expect(el().querySelector('app-pagenotfound')).not.toBeNull();
    expect(el().textContent).toContain('404');
    expect(el().querySelector('section.error_section a')?.getAttribute('href')).toBe('/');
  });

  it('renders a page without a featured image (no hero background, no error)', async () => {
    await setup('moto');
    pageBySlug('moto').flush([item(17, 'moto', 'Moto', false)]);
    await render();
    expect(el().textContent).toContain('Moto');
    expect((el().querySelector('#margintransition') as HTMLElement).style.backgroundImage).toBe('');
  });

  it('renders nothing (and logs) when the request fails — not a 404', async () => {
    spyOn(console, 'error');
    await setup('about-1-5-1');
    pageBySlug('about-1-5-1').flush({}, { status: 500, statusText: 'Server Error' });
    await render();
    expect(el().querySelector('section')).toBeNull();
    expect(el().querySelector('app-pagenotfound')).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});
