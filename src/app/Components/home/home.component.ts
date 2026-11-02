import { Component, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { SeoService, organizationLd, websiteLd } from '../../Services/seo.service';
import { SITE } from '../../Services/seo.config';
import { CarouselComponent } from '../../Components/carousel/carousel.component';
import { PresidentsComponent } from '../../Components/presidents/presidents.component'
import { HistoryComponent } from '../../Components/history/history.component';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [CarouselComponent, HistoryComponent, PresidentsComponent]
})
export class HomeComponent implements OnInit {
  private seo = inject(SeoService);


  ngOnInit() {
    this.seo.apply({
      title: SITE.titleSuffix,
      bareTitle: true,
      description: SITE.description,
      path: '/',
      jsonLd: [organizationLd(), websiteLd()],
    });
  }

}
