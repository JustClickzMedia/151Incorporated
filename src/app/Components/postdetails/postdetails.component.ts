import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { WordpressService } from '../../Services/wordpress.service';
import { Observable } from 'rxjs/internal/Observable';
import { async } from '@angular/core/testing';
import * as $ from 'jquery';
import { Router } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { IPostData } from '../../Model/IPostData'
import { SeoService } from '../../Services/seo.service';


@Component({
  selector: 'app-postdetails',
  templateUrl: './postdetails.component.html',
  styleUrls: ['./postdetails.component.css']
})
export class PostdetailsComponent implements OnInit {

  post$ : Observable<any>;
  posts$ : Observable<any[]>;
  tposts : IPostData;
  pageitem : any;

  constructor( private route: ActivatedRoute,
               private wpService: WordpressService,
               private location: Location,
               private router: Router,
               private seoService: SeoService) { 
                
              this.route.paramMap.subscribe(params => {
                //fetch your new parameters here, on which you are switching the routes and call ngOnInit()
                this.ngOnInit();
              });
              
  }

  ngOnInit() {
    this.seoService.addMetaTags();
    this.getPost(); 
  }

  getPost(): void {
    const id = +this.route.snapshot.paramMap.get('id');
    this.post$ = this.wpService.getPost(id);
    this.posts$ = this.wpService.getPosts();

    this.wpService.getPost(id).subscribe(resp => {
      this.seoService.setTitle(resp['title']['rendered']);
      this.seoService.updateDescMetaTags(resp['excerpt']['rendered']);
      this.tposts = { 
        date : resp['date']
      }   
    });
  }
}
