import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { WordpressService } from '../../Services/wordpress.service';
import { Observable } from 'rxjs/internal/Observable';
import { async } from '@angular/core/testing';
import * as $ from 'jquery';
import {Router} from '@angular/router';
import { SeoService } from '../../Services/seo.service';
import { Subscription } from 'rxjs/internal/Subscription';
import { SidbarpostsComponent } from '../../Components/sidbarposts/sidbarposts.component';


@Component({
    selector: 'app-pagedetails',
    templateUrl: './pagedetails.component.html',
    styleUrls: ['./pagedetails.component.css'],
    imports: [CommonModule, SidbarpostsComponent],
    standalone: true
})
export class PagedetailsComponent implements OnInit, OnDestroy {
 
  page : any;
  page$ : Observable<any>;
  posts$ : Observable<any[]>;
  routParam : Subscription;
  getPageService : Subscription;
  pageitem : any;

  constructor( private route: ActivatedRoute,
               private wpService: WordpressService,
               private location: Location,
               private router: Router,
               private seo: SeoService) { 
                
              this.routParam = this.route.paramMap.subscribe(params => {
                //fetch your new parameters here, on which you are switching the routes and call ngOnInit()
                this.ngOnInit();
              });
  }

  ngOnInit() {
    this.getPage();
    //this.seo.addMetaTags();
  }

  ngOnDestroy(){
    this.routParam.unsubscribe();
    this.getPageService.unsubscribe();
  }

  getPage(): void {
    const id = +this.route.snapshot.paramMap.get('id');
    this.posts$ = this.wpService.getPosts();

    //Seo Work
    this.getPageService = this.wpService.getPage(id).subscribe(resp => { 
      this.page = resp;  
      this.seo.removeMetaTags();
      this.seo.addMetaTags();
      this.seo.setTitle(resp['title']['rendered']);
      this.seo.updateKeywordMetaTags(resp['post-custom-fields']['Keywords']);
      this.seo.updateDescMetaTags(resp['post-custom-fields']['Description']);  
    });
  }
}
