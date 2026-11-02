import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map, switchMap } from 'rxjs/operators';
import { WordpressService } from '../../Services/wordpress.service';
import { withFallback } from '../../Services/rx-fallback';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../Services/seo.service';

@Component({
    selector: 'app-searchresults',
    templateUrl: './searchresults.component.html',
    styleUrls: ['./searchresults.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [CommonModule, RouterLink]
})
export class SearchresultsComponent {
  private route = inject(ActivatedRoute);
  private wpService = inject(WordpressService);

  constructor() {
    // Search result pages are useful to visitors, not to search engines.
    inject(SeoService).apply({ title: 'Search', noindex: true });
  }

  private readonly term$ = this.route.paramMap.pipe(map(params => params.get('term')));

  /** Search term from the route; updates when navigating between searches. */
  readonly term = toSignal(this.term$, { initialValue: this.route.snapshot.paramMap.get('term') });

  /** One request per term (the old code requested twice on load and never unsubscribed). */
  readonly searchResults = toSignal(
    this.term$.pipe(switchMap(term => this.wpService.getSearch(term).pipe(withFallback<any[]>([])))),
    { initialValue: [] as any[] }
  );
}
