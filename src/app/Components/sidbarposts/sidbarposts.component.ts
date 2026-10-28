import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WordpressService } from '../../Services/wordpress.service';
import { Observable } from 'rxjs/internal/Observable';
import { RouterLink } from '@angular/router';
import { IPostData } from '../../Model/IPostData';

@Component({
    selector: 'app-sidbarposts',
    templateUrl: './sidbarposts.component.html',
    styleUrls: ['./sidbarposts.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [RouterLink, CommonModule]
})
export class SidbarpostsComponent implements OnInit {

  posts$ : Observable<any[]>;

  constructor(private wpService: WordpressService,) { }

  ngOnInit() {
    this.posts$ = this.wpService.getPosts();
  }

  
}
