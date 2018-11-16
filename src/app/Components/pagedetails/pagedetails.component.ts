import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { WordpressService } from '../../Services/wordpress.service';
import { Observable } from 'rxjs/internal/Observable';
import { async } from '@angular/core/testing';
import * as $ from 'jquery';
import {Router} from '@angular/router';
import { SeoService } from '../../Services/seo.service';


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
               private router: Router,
               private seo: SeoService) { 
                
              this.route.paramMap.subscribe(params => {
                //fetch your new parameters here, on which you are switching the routes and call ngOnInit()
                this.ngOnInit();
              });
  }

  ngOnInit() {
    this.getPage();
    this.seo.addMetaTags();
  }

  getPage(): void {
    const id = +this.route.snapshot.paramMap.get('id');
    this.page$ = this.wpService.getPage(id);
    this.posts$ = this.wpService.getPosts();

    //Seo Work
    this.wpService.getPost(id).subscribe(resp => {
      this.seo.setTitle(resp['title']['rendered']);
      this.seo.updateDescMetaTags(resp['excerpt']['rendered']);  
    });
  }
}
