import { Component, OnInit } from '@angular/core';
import { WordpressService } from '../../Services/wordpress.service';
import { Observable } from 'rxjs/internal/Observable';
import { CommonModule } from '@angular/common';
import { LinkcssPipe } from '../../Pipes/linkcss.pipe'
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-presidents',
    templateUrl: './presidents.component.html',
    styleUrls: ['./presidents.component.css'],
    imports: [ CommonModule, LinkcssPipe, RouterLink ],
    standalone: true
})
export class PresidentsComponent implements OnInit {
  page$ : Observable<any>;
  posts$ : Observable<any[]>;

  constructor(private wp : WordpressService) {
  } 

  ngOnInit() {
    this.page$ = this.wp.getPage(13);
    this.posts$ = this.wp.getPosts();
  }

}
