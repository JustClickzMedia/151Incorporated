import { Component, OnInit, OnDestroy } from '@angular/core';
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
import { Subscription } from 'rxjs/internal/Subscription';


@Component({
  selector: 'app-postdetails',
  templateUrl: './postdetails.component.html',
  styleUrls: ['./postdetails.component.css']
})
export class PostdetailsComponent implements OnInit, OnDestroy {
  post : any;
  posts$ : Observable<any[]>;
  getPostService : Subscription;
  paramInit : Subscription;

  constructor( private route: ActivatedRoute,
               private wpService: WordpressService,
               private location: Location,
               private router: Router,
               private seo: SeoService) { 
                
              this.paramInit = this.route.paramMap.subscribe(params => {
                //fetch your new parameters here, on which you are switching the routes and call ngOnInit()
                this.ngOnInit();
              });
              
  }

  ngOnInit() {
    this.getPost(); 
  }

  ngOnDestroy(){
    this.paramInit.unsubscribe();
    this.getPostService.unsubscribe();
  }

  getPost(): void {
    const id = +this.route.snapshot.paramMap.get('id');
    this.posts$ = this.wpService.getPosts();

    this.getPostService = this.wpService.getPost(id).subscribe(resp => { 
      this.post = resp;  
      this.seo.removeMetaTags();
      this.seo.addMetaTags();
      this.seo.setTitle(resp['title']['rendered']);
      this.seo.updateKeywordMetaTags(resp['post-custom-fields']['Keywords']);
      this.seo.updateDescMetaTags(resp['post-custom-fields']['Description']);  
    });
  }
}
