import { Component, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Inject } from '@angular/core';
import { Observable } from 'rxjs/internal/Observable';
import { WordpressService } from '../../Services/wordpress.service';
import { CommonModule, DOCUMENT } from '@angular/common'
import { RouterLinkActive, RouterLink } from '@angular/router';
//import { SearchboxComponent } from '../../Components/searchbox/searchbox.component'

@Component({
    selector: 'app-navbar',
    templateUrl: './navbar.component.html',
    styleUrls: ['./navbar.component.css'],
    imports: [ CommonModule, RouterLinkActive, RouterLink ],
    standalone: true
})
export class NavbarComponent implements OnInit {

 
  logo:any = "/images/151Logo.png";
  NavMenu$ : Observable<any[]>;
  navbarOpen = false;
  buttonbrdcolor = "";
  iconlnimage = "";

  constructor(@Inject(DOCUMENT) private document: Document,
              private router: Router,
              private wp: WordpressService) { }

  search(term: string): void {
    console.log('searchterm: ' + term);
  }

  toggleNavbar() {
    this.navbarOpen = !this.navbarOpen;
  }

  @HostListener('document:scroll',['$event'])
  public onViewportScroll() {
    var yOffset = 0
    var currYOffSet = window.pageYOffset;
    var imglarge = "https://tzin.brothersof1-5-1.org/wp-content/uploads/2024/04/brother151logo2-1.png";
    var imgsmall = "https://tzin.brothersof1-5-1.org/wp-content/uploads/2024/04/Brothers-of-1-5-1-Incorporated-219-x-52-px-1.png";
    
    var elheader = document.getElementById('header');
    var element = document.getElementById('header-container');
    var transitionelement = document.getElementById('margintransition');
    var container = document.querySelectorAll('.navbar-brand img')
    if(yOffset < currYOffSet) {
      elheader.classList.add('bgnav');
      element.classList.add('fixed-theme');
      this.buttonbrdcolor = 'rgb(103,0,1)';
      this.iconlnimage = 'test';
      //"background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath stroke='rgba(103,0,1,1)' stroke-width='2' stroke-linecap='round' stroke-miterlimit='10' d='M4 8h24M4 16h24M4 24h24'/%3E%3C/svg%3E\")";
      container[0].setAttribute('src', imgsmall);
      transitionelement.style.marginTop = '30px';
    }
    else if(currYOffSet == yOffset){
      elheader.classList.remove('bgnav');
      element.classList.remove('fixed-theme');
      this.buttonbrdcolor = 'rgb(255,255,255)';
      this.iconlnimage = 'test';
      //'background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath stroke='rgba(255,255,255,0.7)' stroke-width='2' stroke-linecap='round' stroke-miterlimit='10' d='M4 8h24M4 16h24M4 24h24'/%3E%3C/svg%3E\")';
      container[0].setAttribute('src', imglarge);
      setTimeout(this.setDelay, 100);
    }
  }

  public setDelay() {
    var transitionelement = document.getElementById('margintransition');
    transitionelement.style.marginTop = '120px';
  }

  ngOnInit() {
    this.NavMenu$ = this.wp.getPages();
    
    // $(this.document).ready(function(){

    //   var imglarge = "https://tzin.brothersof1-5-1.org/wp-content/uploads/2024/03/151Logo2.png";
    //   var imgsmall = "https://tzin.brothersof1-5-1.org/wp-content/uploads/2024/03/151Logo3.png";
      
    //   /**
    //    * This object controls the nav bar. Implement the add and remove
    //    * action over the elements of the nav bar that we want to change.
    //    *
    //    * @type {{flagAdd: boolean, elements: string[], add: Function, remove: Function}}
    //    */
    //   var myNavBar = {
      
    //       flagAdd: true,
      
    //       elements: [],
      
    //       init: function (elements) {
    //           this.elements = elements;
    //       },
      
    //       add : function() {

    //         $( "#header-container" ).addClass( "fixed-theme" );  
    //         $('.navbar-brand img').attr('src', imgsmall);   
    //         $('#margintransition').css({
    //           'margin-top' : '30px'
    //         });
    //       },
      
    //       remove: function() {
    //         $( "#header-container" ).removeClass( "fixed-theme" );
    //         $('.navbar-brand img').attr('src', imglarge);   
    //         $('#margintransition')
    //         .delay(100)
    //         .queue(function (next) { 
    //           $(this).css({
    //             'margin-top' : '120px'
    //           }); 
    //           next(); 
    //         });
    //       }
      
    //   };
      
    //   /**
    //    * Init the object. Pass the object the array of elements
    //    * that we want to change when the scroll goes down
    //    */
    //   myNavBar.init(  [
    //       "header",
    //       "header-container",
    //       "brand"
    //   ]);
      
    //   /**
    //    * Function that manage the direction
    //    * of the scroll
    //    */
    //   function offSetManager(){
      
    //       var yOffset = 0;
    //       var currYOffSet = window.pageYOffset;
      
    //       if(yOffset < currYOffSet) {
    //           myNavBar.add();
    //       }
    //       else if(currYOffSet == yOffset){
    //           myNavBar.remove();
    //       }
    //   }
      
    //   /**
    //    * bind to the document scroll detection
    //    */
    //   window.onscroll = function(e) {
    //       offSetManager();
    //   }
      
    //   /**
    //    * We have to do a first detectation of offset because the page
    //    * could be load with scroll down set.
    //    */
    //   offSetManager();
    // });
  }

  onSelect(id){
    this.router.navigate(['/page/president', id]);
  }

  
}
