import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Title } from '@angular/platform-browser';
import { of } from 'rxjs';

import { BlogpostComponent } from './blogpost.component';
import { USE_GRAPHQL } from '../../Services/wordpress.service';
import { environment } from '../../../environments/environment';

describe('BlogpostComponent (/blog/:slug)', () => {
  let fixture: ComponentFixture<BlogpostComponent>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  async function setup(slug: string) {
    await TestBed.configureTestingModule({
      imports: [BlogpostComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: USE_GRAPHQL, useValue: true },
                  { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ slug })) } }],
    }).compileComponents();
    fixture = TestBed.createComponent(BlogpostComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }
  const request = (slug: string) => http.expectOne(r => r.url === environment.graphqlUrl && r.body?.variables?.slug === slug);
  const render = async () => { fixture.detectChanges(); await fixture.whenStable(); };

  afterEach(() => http.verify());

  it('shows the post: title, date, category, featured image and full content', async () => {
    await setup('a-new-chapter');
    request('a-new-chapter').flush({ data: { post: {
      databaseId: 175, slug: 'a-new-chapter', title: 'A New Chapter &#8217;26', date: '2026-11-02T05:14:13',
      excerpt: '<p>Short</p>', content: '<h2>Honoring Our History</h2><p>Full text.</p>',
      featuredImage: { node: { sourceUrl: 'https://img.test/p.jpg', altText: '', mediaDetails: { width: 819, height: 1024 } } },
      categories: { nodes: [{ name: 'blog' }] },
    } } });
    await render();
    expect(el().querySelector('h1')?.textContent).toBe('A New Chapter ’26');
    expect(el().querySelector('.meta')?.textContent).toContain('November 2, 2026 · blog');
    expect((el().querySelector('img.feature') as HTMLImageElement).src).toBe('https://img.test/p.jpg');
    expect(el().querySelector('.content h2')?.textContent).toBe('Honoring Our History');
    expect(el().querySelector('a.back')?.getAttribute('href')).toBe('/blog');
    expect(TestBed.inject(Title).getTitle()).toBe('A New Chapter ’26');
  });

  it('shows the 404 view for an unknown slug', async () => {
    await setup('nope');
    request('nope').flush({ data: { post: null } });
    await render();
    expect(el().querySelector('app-pagenotfound')).not.toBeNull();
  });

  it('shows a friendly message (and logs) when WordPress fails', async () => {
    spyOn(console, 'error');
    await setup('x');
    request('x').flush({}, { status: 500, statusText: 'Server Error' });
    await render();
    expect(el().textContent).toContain("couldn't be loaded");
  });
});
