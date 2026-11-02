import { Component, ChangeDetectionStrategy, DOCUMENT, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { WordpressService } from '../../Services/wordpress.service';
import { SeoService } from '../../Services/seo.service';
import { WpPost, formatPostDate } from '../../Model/wp-post';

export type BlogView = 'list' | 'grid';
/** The visitor's last choice of list/grid, remembered in this browser. */
export const BLOG_VIEW_KEY = 'bo151.blogView';
/** Posts shown on the blog page (newest first). */
export const BLOG_PAGE_POSTS = 100;

type BlogState = { status: 'loading' } | { status: 'ready'; posts: WpPost[] } | { status: 'error' };

/**
 * Blog page (/blog, menu BLOG): all published posts, newest first, with a List / Grid toggle.
 * Each row or card opens the post (/blog/<slug>). No posts → a "no posts yet" message.
 */
@Component({
  selector: 'app-blog',
  templateUrl: './blog.component.html',
  styleUrls: ['./blog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
})
export class BlogComponent {
  private wp = inject(WordpressService);
  private storage = inject(DOCUMENT).defaultView?.localStorage;

  readonly state = toSignal(
    this.wp.getBlogPosts(BLOG_PAGE_POSTS).pipe(
      map((posts): BlogState => ({ status: 'ready', posts })),
      catchError(err => { console.error(err); return of<BlogState>({ status: 'error' }); })
    ),
    { initialValue: { status: 'loading' } as BlogState }
  );

  readonly posts = computed(() => { const s = this.state(); return s.status === 'ready' ? s.posts : []; });
  readonly loading = computed(() => this.state().status === 'loading');
  readonly failed = computed(() => this.state().status === 'error');
  readonly empty = computed(() => this.state().status === 'ready' && this.posts().length === 0);

  readonly view = signal<BlogView>(this.savedView());

  constructor() {
    const seo = inject(SeoService);
    seo.removeMetaTags();
    seo.addMetaTags();
    seo.setTitle('Blog | 1-5-1 Incorporated');
  }

  setView(view: BlogView) {
    this.view.set(view);
    try { this.storage?.setItem(BLOG_VIEW_KEY, view); } catch { /* storage unavailable: don't remember */ }
  }

  dateLabel(post: WpPost) { return formatPostDate(post.date); }

  private savedView(): BlogView {
    try { return this.storage?.getItem(BLOG_VIEW_KEY) === 'grid' ? 'grid' : 'list'; } catch { return 'list'; }
  }
}
