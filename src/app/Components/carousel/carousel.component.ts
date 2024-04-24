import { Component, OnInit } from '@angular/core';
import { RouterLinkActive, RouterLink } from '@angular/router';

@Component({
    selector: 'app-carousel',
    templateUrl: './carousel.component.html',
    styleUrls: ['./carousel.component.css'],
    imports: [ RouterLinkActive, RouterLink ],
    standalone: true
})
export class CarouselComponent implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
