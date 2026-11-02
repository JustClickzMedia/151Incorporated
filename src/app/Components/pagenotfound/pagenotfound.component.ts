import { Component, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { SeoService } from '../../Services/seo.service';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-pagenotfound',
    templateUrl: './pagenotfound.component.html',
    styleUrls: ['./pagenotfound.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [RouterLink]
})
export class PagenotfoundComponent implements OnInit {

  private seo = inject(SeoService);

  ngOnInit() {
    // Keep "not found" views out of search results.
    this.seo.apply({ title: 'Page not found', noindex: true });
  }

}
