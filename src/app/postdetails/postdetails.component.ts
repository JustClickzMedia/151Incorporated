import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { WordpressService } from '../wordpress.service';
import { Observable } from 'rxjs/internal/Observable';
import { async } from '@angular/core/testing';
import * as $ from 'jquery';
import {Router} from '@angular/router';
import { Meta } from '@angular/platform-browser';

@Component({
  selector: 'app-postdetails',
  templateUrl: './postdetails.component.html',
  styleUrls: ['./postdetails.component.css']
})
export class PostdetailsComponent implements OnInit {

  post$ : Observable<any>;
  posts$ : Observable<any[]>;
  pageitem : any;

  constructor( private route: ActivatedRoute,
               private wpService: WordpressService,
               private location: Location,
               private router: Router,
               private meta: Meta) { 
                
              this.route.paramMap.subscribe(params => {
                //fetch your new parameters here, on which you are switching the routes and call ngOnInit()
                this.ngOnInit();
              });
              this.meta.addTag({ name: 'description', content: 'How to use Angular 4 meta service' });
  }

  ngOnInit() {
    this.getPost();
  }

  getPost(): void {
    const id = +this.route.snapshot.paramMap.get('id');
    console.log(id);
    this.post$ = this.wpService.getPost(id);
    this.posts$ = this.wpService.getPosts();
  }

}
