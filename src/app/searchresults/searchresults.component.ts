import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { WordpressService } from '../wordpress.service';
import { Observable } from 'rxjs/internal/Observable';

@Component({
  selector: 'app-searchresults',
  templateUrl: './searchresults.component.html',
  styleUrls: ['./searchresults.component.css']
})
export class SearchresultsComponent implements OnInit {

  searchResults$: Observable<any[]>;
  term: string;

  constructor(private route: ActivatedRoute,
              private wpService: WordpressService,) { 
    this.route.paramMap.subscribe(params => {
      //fetch your new parameters here, on which you are switching the routes and call ngOnInit()
      this.ngOnInit();
      //this.meta.updateTag({ name: 'description', content: this.tposts.date });
    });
  }

  ngOnInit() {
    this.term = this.route.snapshot.paramMap.get('term');
    this.searchResults$ = this.wpService.getSearch(this.term);
  }

}
