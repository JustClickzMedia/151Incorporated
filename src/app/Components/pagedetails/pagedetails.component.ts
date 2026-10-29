import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { WordpressService } from '../../Services/wordpress.service';
import { SeoService } from '../../Services/seo.service';
import { SidbarpostsComponent } from '../../Components/sidbarposts/sidbarposts.component';
import { PagenotfoundComponent } from '../../Components/pagenotfound/pagenotfound.component';
import { WpPage } from '../../Model/wp-page';

/** loading: request in flight · found: page loaded · notfound: no page has that slug · error: request failed */
type PageState =
  | { status: 'loading' }
  | { status: 'found'; page: WpPage }
  | { status: 'notfound' }
  | { status: 'error' };

@Component({
    selector: 'app-pagedetails',
    templateUrl: './pagedetails.component.html',
    styleUrls: ['./pagedetails.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [CommonModule, SidbarpostsComponent, PagenotfoundComponent]
})
export class PagedetailsComponent {
  private route = inject(ActivatedRoute);
  private wpService = inject(WordpressService);
  private seo = inject(SeoService);

  /**
   * The WordPress page for the current ':slug' route param. Re-fetches when the param changes
   * (switchMap cancels the previous request), and unsubscribes automatically on destroy.
   */
  readonly state = toSignal(this.route.paramMap.pipe(
    map(params => (params.get('slug') ?? '').trim()),
    switchMap(slug => this.load(slug)),
    tap(state => { if (state.status === 'found') { this.applySeo(state.page); } })
  ), { initialValue: { status: 'loading' } as PageState });

  readonly page = computed(() => { const s = this.state(); return s.status === 'found' ? s.page : undefined; });
  readonly notFound = computed(() => this.state().status === 'notfound');
  /** Hero image; pages without a featured image just get no background instead of a template error. */
  readonly heroUrl = computed<string | undefined>(() => this.page()?.featuredImage?.url);

  private load(slug: string): Observable<PageState> {
    if (!slug) {
      return of({ status: 'notfound' });
    }
    return this.wpService.getPageBySlug(slug).pipe(
      map((page): PageState => page ? { status: 'found', page } : { status: 'notfound' }),
      // Same as before for failures: logged, section stays empty (not shown as a 404).
      catchError(err => { console.error(err); return of<PageState>({ status: 'error' }); })
    );
  }

  private applySeo(page: WpPage): void {
    try {
      this.seo.removeMetaTags();
      this.seo.addMetaTags();
      this.seo.setTitle(page.title);
      // The old 'post-custom-fields' Keywords/Description don't exist in REST or GraphQL; use the excerpt instead.
      if (page.excerptText) { this.seo.updateDescMetaTags(page.excerptText); }
    } catch (err) {
      // Same as before: an SEO problem is logged, the content still renders.
      console.error(err);
    }
  }
}
