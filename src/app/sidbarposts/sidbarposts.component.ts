import { Component, OnInit } from '@angular/core';
import { WordpressService } from '../wordpress.service';
import { Observable } from 'rxjs/internal/Observable';
import { async } from '@angular/core/testing';

@Component({
  selector: 'app-sidbarposts',
  templateUrl: './sidbarposts.component.html',
  styleUrls: ['./sidbarposts.component.css']
})
export class SidbarpostsComponent implements OnInit {

  posts$ : Observable<any[]>;

  constructor(private wpService: WordpressService,) { }

  ngOnInit() {
    this.posts$ = this.wpService.getPosts();
  }

  
}
