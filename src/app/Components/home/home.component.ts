import { Component, OnInit } from '@angular/core';
import { SeoService } from '../../Services/seo.service';
import { CarouselComponent } from '../../Components/carousel/carousel.component';
import { HomebuttonsectionComponent } from '../../Components/homebuttonsection/homebuttonsection.component';
import { PresidentsComponent } from '../../Components/presidents/presidents.component'

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css'],
    standalone: true,
    imports: [CarouselComponent, HomebuttonsectionComponent, PresidentsComponent]
})
export class HomeComponent implements OnInit {

  constructor(private seo: SeoService) { }

  ngOnInit() {
    this.seo.addMetaTags();
    this.seo.setTitle('1-5-1 Incorporated');
  }

}
