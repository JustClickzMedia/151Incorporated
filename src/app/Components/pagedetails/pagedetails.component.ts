import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { WordpressService } from '../../Services/wordpress.service';
import { Observable } from 'rxjs/internal/Observable';
import { async } from '@angular/core/testing';
import * as $ from 'jquery';
import {Router} from '@angular/router';


@Component({
  selector: 'app-pagedetails',
  templateUrl: './pagedetails.component.html',
  styleUrls: ['./pagedetails.component.css']
})
export class PagedetailsComponent implements OnInit {

  page$ : Observable<any>;
  posts$ : Observable<any[]>;
  pageitem : any;

  constructor( private route: ActivatedRoute,
               private wpService: WordpressService,
               private location: Location,
               private router: Router) { 
                
              this.route.paramMap.subscribe(params => {
                //fetch your new parameters here, on which you are switching the routes and call ngOnInit()
                this.ngOnInit();
              });
  }

  ngOnInit() {
    this.getPage();
  }

  getPage(): void {
    const id = +this.route.snapshot.paramMap.get('id');
    this.page$ = this.wpService.getPage(id);
    this.posts$ = this.wpService.getPosts();
  }
}
