import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { PagedetailsComponent } from '../../Components/pagedetails/pagedetails.component'

@Component({
    selector: 'app-details',
    templateUrl: './details.component.html',
    styleUrls: ['./details.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [PagedetailsComponent]
})
export class DetailsComponent implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
