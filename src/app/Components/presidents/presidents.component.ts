import { Component, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { WordpressService } from '../../Services/wordpress.service';
import { Observable } from 'rxjs/internal/Observable';
import { CommonModule } from '@angular/common';
import { LinkcssPipe } from '../../Pipes/linkcss.pipe'
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-presidents',
    templateUrl: './presidents.component.html',
    styleUrls: ['./presidents.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [CommonModule, LinkcssPipe, RouterLink]
})
export class PresidentsComponent implements OnInit {
  private wp = inject(WordpressService);

  page$ : Observable<any>;
  posts$ : Observable<any[]>; 

  ngOnInit() {
    this.page$ = this.wp.getPage(13);
    this.posts$ = this.wp.getPosts();
  }

}
