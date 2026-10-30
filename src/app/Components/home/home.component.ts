import { Component, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { SeoService } from '../../Services/seo.service';
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
    this.seo.addMetaTags();
    this.seo.setTitle('1-5-1 Incorporated');
  }

}
