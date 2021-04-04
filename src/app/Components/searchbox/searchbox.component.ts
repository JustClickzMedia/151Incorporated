import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Searchitem } from '../../Model/searchitem';


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
    this.model.searchstring = "";
  }

  onSubmit() { 
    this.router.navigateByUrl("/search/" + this.model.searchstring) 
  }
}
