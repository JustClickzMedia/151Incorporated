import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BehaviorSubject } from 'rxjs';

import { SearchresultsComponent } from './searchresults.component';
import { environment } from '../../../environments/environment';

describe('SearchresultsComponent', () => {
  let fixture: ComponentFixture<SearchresultsComponent>;
  let http: HttpTestingController;
  let params: BehaviorSubject<ParamMap>;

  beforeEach(async () => {
    params = new BehaviorSubject<ParamMap>(convertToParamMap({ term: 'dues' }));
    await TestBed.configureTestingModule({
      imports: [SearchresultsComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: params.asObservable(), snapshot: { paramMap: params.value } } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SearchresultsComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('searches once for the route term and renders results', async () => {
    http.expectOne(environment.restUrl + 'posts?search=dues')
      .flush([{ id: 1, title: { rendered: 'Dues info' }, date: '2026-01-02T10:00:00' }]);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Search results for dues');
    expect(el.textContent).toContain('Dues info');
    expect(el.textContent).not.toMatch(/January|2026|10:00/); // no post dates
  });

  it('searches again when the term changes', async () => {
    http.expectOne(environment.restUrl + 'posts?search=dues').flush([]);
    params.next(convertToParamMap({ term: 'events' }));
    http.expectOne(environment.restUrl + 'posts?search=events').flush([]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Search results for events');
  });
});
