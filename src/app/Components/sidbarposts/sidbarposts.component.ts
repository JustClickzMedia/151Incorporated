import { Component, OnInit,  } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WordpressService } from '../../Services/wordpress.service';
import { Observable } from 'rxjs/internal/Observable';
import { RouterLink } from '@angular/router';
import { IPostData } from '../../Model/IPostData';
import { async } from '@angular/core/testing';

@Component({
    selector: 'app-sidbarposts',
    templateUrl: './sidbarposts.component.html',
    styleUrls: ['./sidbarposts.component.css'],
    imports: [ RouterLink, CommonModule ],
    standalone: true
})
export class SidbarpostsComponent implements OnInit {

  posts$ : Observable<any[]>;

  constructor(private wpService: WordpressService,) { }

  ngOnInit() {
    this.posts$ = this.wpService.getPosts();
  }

  
}
