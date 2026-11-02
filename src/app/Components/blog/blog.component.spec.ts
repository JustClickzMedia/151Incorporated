import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Title } from '@angular/platform-browser';

import { BLOG_VIEW_KEY, BlogComponent } from './blog.component';
import { USE_GRAPHQL } from '../../Services/wordpress.service';
import { environment } from '../../../environments/environment';
import { postNode } from '../blogcarousel/blogcarousel.component.spec';

describe('BlogComponent (/blog)', () => {
  let fixture: ComponentFixture<BlogComponent>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    localStorage.removeItem(BLOG_VIEW_KEY);
    await TestBed.configureTestingModule({
      imports: [BlogComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: USE_GRAPHQL, useValue: true }],
    }).compileComponents();
    fixture = TestBed.createComponent(BlogComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => { http.verify(); localStorage.removeItem(BLOG_VIEW_KEY); });

  const respond = async (nodes: unknown[]) => {
    http.expectOne(r => r.url === environment.graphqlUrl && /posts\(/.test(r.body?.query)).flush({ data: { posts: { nodes } } });
    fixture.detectChanges();
    await fixture.whenStable();
  };

  it('says there are no posts yet (no toggle) when the blog is empty', async () => {
    await respond([]);
    expect(el().querySelector('.no-posts h2')?.textContent).toContain('There are no blog posts yet.');
    expect(el().querySelector('.view-toggle')).toBeNull();
    expect(TestBed.inject(Title).getTitle()).toBe('Blog | 1-5-1 Incorporated');
  });

  it('lists posts (list view by default), each row linking to the post', async () => {
    await respond([postNode(1), postNode(2)]);
    const rows = Array.from(el().querySelectorAll('.post-rows a.post-row'));
    expect(rows.map(r => r.getAttribute('href'))).toEqual(['/blog/post-1', '/blog/post-2']);
    expect(rows[0].textContent).toContain('Excerpt of post 1');
    expect(rows[0].querySelector('.meta')?.textContent).toContain('blog');
    expect(el().querySelector('.post-grid')).toBeNull();
  });

  it('guests can switch to grid view and back; the choice is remembered', async () => {
    await respond([postNode(1), postNode(2)]);
    (el().querySelectorAll('.view-toggle button')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(Array.from(el().querySelectorAll('.post-grid a.post-card')).map(a => a.getAttribute('href'))).toEqual(['/blog/post-1', '/blog/post-2']);
    expect(el().querySelector('.post-rows')).toBeNull();
    expect(localStorage.getItem(BLOG_VIEW_KEY)).toBe('grid');
    (el().querySelectorAll('.view-toggle button')[0] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el().querySelector('.post-rows')).not.toBeNull();
  });
});
