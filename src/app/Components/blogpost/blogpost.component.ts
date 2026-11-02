import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { WordpressService } from '../../Services/wordpress.service';
import { SeoService, breadcrumbLd } from '../../Services/seo.service';
import { SITE, metaText, siteUrl } from '../../Services/seo.config';
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
      const path = '/blog/' + post.slug;
      const title = metaText(post.title, 120);
      const published = post.date ? post.date : undefined;
      this.seo.apply({
        title,
        description: post.excerptText,
        path,
        type: 'article',
        publishedTime: published,
        image: post.image,
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: title,
            description: metaText(post.excerptText),
            datePublished: published,
            url: siteUrl(path),
            mainEntityOfPage: siteUrl(path),
            image: post.image ? [post.image.url] : undefined,
            author: { '@type': 'Organization', name: SITE.name, url: SITE.url + '/' },
            publisher: { '@id': SITE.url + '/#organization' },
          },
          breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Blog', path: '/blog' }, { name: title, path }]),
        ],
      });
    } catch (err) {
      console.error(err);
    }
  }
}
