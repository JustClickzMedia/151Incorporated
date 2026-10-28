import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Title } from '@angular/platform-browser';
import { BehaviorSubject } from 'rxjs';

import { PostdetailsComponent } from './postdetails.component';
import { environment } from '../../../environments/environment';

describe('PostdetailsComponent', () => {
  let fixture: ComponentFixture<PostdetailsComponent>;
  let http: HttpTestingController;
  let params: BehaviorSubject<ParamMap>;

  const item = (id: number, title: string) => ({
    id, date: '2026-01-02T10:00:00',
    title: { rendered: title }, content: { rendered: '<p>Body ' + id + '</p>' },
    _embedded: { 'wp:featuredmedia': [{ media_details: { sizes: { full: { source_url: 'https://example.test/img.jpg' } } } }] },
    'post-custom-fields': { Keywords: 'k', Description: 'd' },
  });

  /** The sidebar requests posts too; flush those so verify() only checks what this spec cares about. */
  const flushSidebar = () =>
    http.match(r => r.url === environment.restUrl + 'posts?_embed').forEach(r => r.flush([]));

  beforeEach(async () => {
    params = new BehaviorSubject<ParamMap>(convertToParamMap({ id: '5', title: 'x' }));
    await TestBed.configureTestingModule({
      imports: [PostdetailsComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: params.asObservable() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PostdetailsComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => { flushSidebar(); http.verify(); });

  it('loads the post for the route id once and renders it', async () => {
    http.expectOne(environment.restUrl + 'posts/5?_embed').flush(item(5, 'Five'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Five');
    expect(TestBed.inject(Title).getTitle()).toBe('Five');
  });

  it('re-fetches when the route id changes', async () => {
    http.expectOne(environment.restUrl + 'posts/5?_embed').flush(item(5, 'Five'));
    params.next(convertToParamMap({ id: '6', title: 'y' }));
    http.expectOne(environment.restUrl + 'posts/6?_embed').flush(item(6, 'Six'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Six');
  });

  it('renders nothing (and logs) when the request fails', async () => {
    spyOn(console, 'error');
    http.expectOne(environment.restUrl + 'posts/5?_embed').flush({}, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('section')).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});
