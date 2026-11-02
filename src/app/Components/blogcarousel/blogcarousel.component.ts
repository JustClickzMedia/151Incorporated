import { Component, ChangeDetectionStrategy, ElementRef, afterRenderEffect, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { WordpressService } from '../../Services/wordpress.service';
import { WpPost, formatPostDate } from '../../Model/wp-post';

/** How many of the newest posts the homepage carousel holds (four are visible at a time on desktop). */
export const BLOG_CAROUSEL_POSTS = 12;

/**
 * Homepage "From the Blog": a carousel of the newest blog posts as tiles (featured image, title, short
 * description, "Read More"), four visible at a time on desktop, two on tablets, one on phones; arrows (and
 * swipe/scroll) move through the rest. Each tile opens the post (/blog/<slug>). Hidden when there are no posts.
 */
@Component({
  selector: 'app-blog-carousel',
  templateUrl: './blogcarousel.component.html',
  styleUrls: ['./blogcarousel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
})
export class BlogcarouselComponent {
  private wp = inject(WordpressService);

  readonly posts = toSignal(
    this.wp.getBlogPosts(BLOG_CAROUSEL_POSTS).pipe(catchError(err => { console.error(err); return of<WpPost[]>([]); })),
    { initialValue: [] as WpPost[] }
  );

  private readonly track = viewChild<ElementRef<HTMLElement>>('track');
  readonly canPrev = signal(false);
  readonly canNext = signal(false);

  constructor() {
    // After the tiles render (and whenever the list changes), work out whether the arrows can move.
    afterRenderEffect(() => { this.posts(); this.updateArrows(); });
  }

  dateLabel(post: WpPost) { return formatPostDate(post.date); }

  /** Move one "page" of tiles (the visible width) left or right. */
  scroll(direction: 1 | -1) {
    const el = this.track()?.nativeElement;
    el?.scrollBy({ left: direction * el.clientWidth, behavior: 'smooth' });
  }

  updateArrows() {
    const el = this.track()?.nativeElement;
    if (!el) { return; }
    this.canPrev.set(el.scrollLeft > 4);
    this.canNext.set(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }
}
