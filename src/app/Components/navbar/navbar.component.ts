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

  constructor(@Inject(DOCUMENT) private document: Document,
              private router: Router,
              private wp: WordpressService) { }

  search(term: string): void {
    console.log('searchterm: ' + term);
  }

  toggleNavbar() {
    this.navbarOpen = !this.navbarOpen;
  }

  // @HostListener('window.scroll',['$event']) onscroll(){

  //   let myTag = this.el.nativeElement.
    
  //   querySelector("p")
  //   var yOffset = 0
  //   var currYOffSet = window.pageYOffset;
  //   var imglarge = "https://tzin.brothersof1-5-1.org/wp-content/uploads/2024/03/151Logo2.png";
  //   var imgsmall = "https://tzin.brothersof1-5-1.org/wp-content/uploads/2024/03/151Logo3.png";
      
  //   if(yOffset < currYOffSet) {
  //     this.renderer.addClass("header-container","fixed-theme")
  //   }
  //   else if(currYOffSet == yOffset){
  //     this.renderer.removeClass("header-container","fixed-theme")
  //   }
  // }
  @HostListener('document:scroll',['$event'])
  public onViewportScroll() {
    var yOffset = 0
    var currYOffSet = window.pageYOffset;
    var imglarge = "https://tzin.brothersof1-5-1.org/wp-content/uploads/2024/03/151Logo2.png";
    var imgsmall = "https://tzin.brothersof1-5-1.org/wp-content/uploads/2024/03/151Logo3.png";
    
    var element = document.getElementById('header-container');
    var transitionelement = document.getElementById('margintransition');
    var container = document.querySelectorAll('.navbar-brand img')
    if(yOffset < currYOffSet) {
      element.classList.add('fixed-theme');
      container[0].setAttribute('src', imgsmall);
      transitionelement.style.marginTop = '30px';
    }
    else if(currYOffSet == yOffset){
      element.classList.remove('fixed-theme');
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
