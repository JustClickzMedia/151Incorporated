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
      // Legacy address: let the new /blog/<slug> page be the one search engines index.
      const slug = resp?.slug;
      this.seo.apply({
        title: resp?.title?.rendered ?? 'Post',
        description: resp?.excerpt?.rendered,
        path: slug ? '/blog/' + slug : undefined,
      });
    } catch (err) {
      console.error(err);
    }
  }
}
