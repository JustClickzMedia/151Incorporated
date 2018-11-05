import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Searchitem } from '../../model/searchitem';


@Component({
  selector: 'app-searchbox',
  templateUrl: './searchbox.component.html',
  styleUrls: ['./searchbox.component.css']
})
export class SearchboxComponent implements OnInit {

  model = new Searchitem();
  submitted = false;
  
  constructor(private router:Router) { }

  ngOnInit() {
  }

  onSubmit() { 
    this.router.navigateByUrl("/search/" + this.model.searchstring) 
  }
}
