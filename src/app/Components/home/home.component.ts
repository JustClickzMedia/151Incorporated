import { Component, OnInit } from '@angular/core';
import { SeoService } from '../../Services/seo.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {

  constructor(private seo: SeoService) { }

  ngOnInit() {
    this.seo.addMetaTags();
    this.seo.setTitle('1-5-1 Incorporated');
  }

}
