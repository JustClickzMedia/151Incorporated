import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { PresidentsComponent } from './presidents.component';
import { environment } from '../../../environments/environment';

describe('PresidentsComponent', () => {
  let fixture: ComponentFixture<PresidentsComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PresidentsComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(PresidentsComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const flushPosts = (body: any) =>
    http.expectOne(r => r.url === environment.restUrl + 'posts?_embed').flush(body);

  it('renders the page excerpt and posts from REST', async () => {
    http.expectOne(environment.restUrl + 'pages/13?_embed')
      .flush({ id: 13, title: { rendered: 'Welcome' }, excerpt: { rendered: '<p>Excerpt text</p>' } });
    flushPosts([{ id: 7, title: { rendered: 'Post A' }, date: '2026-01-02T10:00:00' }]);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Excerpt text');
    expect(el.textContent).toContain('Continue Read More');
    expect(el.textContent).toContain('Post A');
  });

  it('still renders the static sections when the page request fails (page 13 is a 404 today)', async () => {
    spyOn(console, 'error');
    http.expectOne(environment.restUrl + 'pages/13?_embed')
      .flush({ code: 'rest_post_invalid_id' }, { status: 404, statusText: 'Not Found' });
    flushPosts([]);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('God Before All');
    expect(el.textContent).toContain('Strategic Objectives');
    expect(el.textContent).not.toContain('Continue Read More');
    expect(console.error).toHaveBeenCalled();
  });
});
