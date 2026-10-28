import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'app-carousel',
    templateUrl: './carousel.component.html',
    styleUrls: ['./carousel.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: true
})
export class CarouselComponent implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
