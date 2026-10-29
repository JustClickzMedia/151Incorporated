import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { WordpressService } from '../../Services/wordpress.service';
import { CarouselSlide } from '../../Model/carousel-slide';
import { CAROUSEL_LINKS } from './carousel-links';

/** loading: request in flight · cms: slides from WordPress · static: the built-in slides (GraphQL off, empty or failed) */
type CarouselState = { status: 'loading' } | { status: 'cms'; slides: CarouselSlide[] } | { status: 'static' };

@Component({
    selector: 'app-carousel',
    templateUrl: './carousel.component.html',
    styleUrls: ['./carousel.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [RouterLink]
})
export class CarouselComponent {
  private wp = inject(WordpressService);

  readonly state = toSignal(
    this.wp.getHomepageCarousels().pipe(
      map((slides): CarouselState => slides.length ? { status: 'cms', slides } : { status: 'static' }),
      // Same rule as elsewhere: log and keep the page working (here: show the built-in slides).
      catchError(err => { console.error(err); return of<CarouselState>({ status: 'static' }); })
    ),
    { initialValue: { status: 'loading' } as CarouselState }
  );

  readonly slides = computed(() => { const s = this.state(); return s.status === 'cms' ? s.slides : []; });
  readonly showStatic = computed(() => this.state().status === 'static');

  /** Caption button for a WordPress slide (undefined = caption title only). */
  linkFor(slide: CarouselSlide) {
    return CAROUSEL_LINKS[slide.id];
  }
}
