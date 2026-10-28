import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { map, switchMap, tap } from 'rxjs/operators';
import { WordpressService } from '../../Services/wordpress.service';
import { withFallback } from '../../Services/rx-fallback';
import { SeoService } from '../../Services/seo.service';
import { SidbarpostsComponent } from '../../Components/sidbarposts/sidbarposts.component';


@Component({
    selector: 'app-pagedetails',
    templateUrl: './pagedetails.component.html',
    styleUrls: ['./pagedetails.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [CommonModule, SidbarpostsComponent]
})
export class PagedetailsComponent {
  private route = inject(ActivatedRoute);
  private wpService = inject(WordpressService);
  private seo = inject(SeoService);

  /**
   * The WordPress page for the current ':id' route param. Re-fetches when the param changes
   * (switchMap cancels the previous request), and unsubscribes automatically on destroy.
   */
  readonly page = toSignal(this.route.paramMap.pipe(
    map(params => +params.get('id')),
    switchMap(id => this.wpService.getPage(id).pipe(withFallback<any>(undefined))),
    tap(resp => { if (resp) { this.applySeo(resp); } })
  ));

  private applySeo(resp: any): void {
    try {
      this.seo.removeMetaTags();
      this.seo.addMetaTags();
      this.seo.setTitle(resp['title']['rendered']);
      this.seo.updateKeywordMetaTags(resp['post-custom-fields']['Keywords']);
      this.seo.updateDescMetaTags(resp['post-custom-fields']['Description']);
    } catch (err) {
      // Same as before: a missing SEO field is logged, the content still renders.
      console.error(err);
    }
  }
}
