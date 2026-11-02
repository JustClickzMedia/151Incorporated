import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { WordpressService } from '../../Services/wordpress.service';
import { SeoService } from '../../Services/seo.service';
import { PagenotfoundComponent } from '../pagenotfound/pagenotfound.component';
import { WpPost, formatPostDate } from '../../Model/wp-post';

type PostState = { status: 'loading' } | { status: 'found'; post: WpPost } | { status: 'notfound' } | { status: 'error' };

/** One blog post: /blog/<slug>. Title, date, categories, featured image (uncropped) and the full post. */
@Component({
  selector: 'app-blogpost',
  templateUrl: './blogpost.component.html',
  styleUrls: ['./blogpost.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PagenotfoundComponent],
})
export class BlogpostComponent {
  private route = inject(ActivatedRoute);
  private wp = inject(WordpressService);
  private seo = inject(SeoService);

  readonly state = toSignal(this.route.paramMap.pipe(
    map(p => (p.get('slug') ?? '').trim()),
    switchMap(slug => this.load(slug)),
    tap(s => { if (s.status === 'found') { this.applySeo(s.post); } })
  ), { initialValue: { status: 'loading' } as PostState });

  readonly post = computed(() => { const s = this.state(); return s.status === 'found' ? s.post : undefined; });
  readonly notFound = computed(() => this.state().status === 'notfound');
  readonly failed = computed(() => this.state().status === 'error');
  readonly loading = computed(() => this.state().status === 'loading');
  readonly dateLabel = computed(() => formatPostDate(this.post()?.date ?? ''));

  private load(slug: string): Observable<PostState> {
    if (!slug) { return of({ status: 'notfound' }); }
    return this.wp.getBlogPost(slug).pipe(
      map((post): PostState => post ? { status: 'found', post } : { status: 'notfound' }),
      catchError(err => { console.error(err); return of<PostState>({ status: 'error' }); })
    );
  }

  private applySeo(post: WpPost): void {
    try {
      this.seo.removeMetaTags();
      this.seo.addMetaTags();
      // Titles can contain entities (&#8217;); the browser tab should show plain text.
      this.seo.setTitle(post.title.replace(/&#8217;|&rsquo;/g, '’').replace(/&#8216;|&lsquo;/g, '‘').replace(/&amp;/g, '&'));
      if (post.excerptText) { this.seo.updateDescMetaTags(post.excerptText); }
    } catch (err) {
      console.error(err);
    }
  }
}
