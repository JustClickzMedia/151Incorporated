import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-pagenotfound',
    templateUrl: './pagenotfound.component.html',
    styleUrls: ['./pagenotfound.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [RouterLink]
})
export class PagenotfoundComponent implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
