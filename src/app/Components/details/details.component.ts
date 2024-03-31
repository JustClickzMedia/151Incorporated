import { Component, OnInit } from '@angular/core';
import { PagedetailsComponent } from '../../Components/pagedetails/pagedetails.component'

@Component({
    selector: 'app-details',
    templateUrl: './details.component.html',
    styleUrls: ['./details.component.css'],
    imports: [ PagedetailsComponent ],
    standalone: true
})
export class DetailsComponent implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
