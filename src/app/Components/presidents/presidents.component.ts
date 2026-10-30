import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { WordpressService } from '../../Services/wordpress.service';
import { withFallback } from '../../Services/rx-fallback';
import { HOMEPAGE_SLUG } from '../../homepage.config';
import { CommonModule } from '@angular/common';
import { LinkcssPipe } from '../../Pipes/linkcss.pipe'
import { WpPage } from '../../Model/wp-page';

@Component({
    selector: 'app-presidents',
    templateUrl: './presidents.component.html',
    styleUrls: ['./presidents.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [CommonModule, LinkcssPipe]
})
export class PresidentsComponent {
  private wp = inject(WordpressService);
  private homepageSlug = inject(HOMEPAGE_SLUG);

  /** Homepage page, loaded by slug (not by ID). No slug configured yet = no request. */
  readonly page = this.homepageSlug
    ? toSignal(this.wp.getPageBySlug(this.homepageSlug).pipe(withFallback<WpPage | undefined>(undefined)))
    : signal<WpPage | undefined>(undefined).asReadonly();

}
