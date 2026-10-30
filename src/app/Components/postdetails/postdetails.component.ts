import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { map, switchMap, tap } from 'rxjs/operators';
import { WordpressService } from '../../Services/wordpress.service';
import { withFallback } from '../../Services/rx-fallback';
import { SeoService } from '../../Services/seo.service';


@Component({
    selector: 'app-postdetails',
    templateUrl: './postdetails.component.html',
    styleUrls: ['./postdetails.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [CommonModule]
})
export class PostdetailsComponent {
  private route = inject(ActivatedRoute);
  private wpService = inject(WordpressService);
  private seo = inject(SeoService);

  /**
   * The WordPress post for the current ':id' route param. Re-fetches when the param changes
   * (switchMap cancels the previous request), and unsubscribes automatically on destroy.
   */
  readonly post = toSignal(this.route.paramMap.pipe(
    map(params => +params.get('id')),
    switchMap(id => this.wpService.getPost(id).pipe(withFallback<any>(undefined))),
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
