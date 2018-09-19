import { Component, OnInit } from '@angular/core';

import { WordpressService } from '../wordpress.service';
import { Observable } from 'rxjs/internal/Observable';

@Component({
  selector: 'app-presidents',
  templateUrl: './presidents.component.html',
  styleUrls: ['./presidents.component.css']
})
export class PresidentsComponent implements OnInit {
  page$ : Observable<any>;
  posts$ : Observable<any[]>;

  constructor(private wp : WordpressService) {
  }

  ngOnInit() {
    this.page$ = this.wp.getPage(310);
    this.posts$ = this.wp.getPosts();
  }

}
