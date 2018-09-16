import { Component, OnInit } from '@angular/core';
import * as $ from 'jquery';
import { Router } from '@angular/router';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit {

  logo:any = "/images/151Logo.png";
  constructor(private router: Router) { }

  ngOnInit() {
    

    $(document).ready(function(){

      var imglarge = "http://oxygen.1-5-1.org/wp-content/uploads/2018/09/151Logo2.png";
      var imgsmall = "http://oxygen.1-5-1.org/wp-content/uploads/2018/09/151Logo3.png";
      
      /**
       * This object controls the nav bar. Implement the add and remove
       * action over the elements of the nav bar that we want to change.
       *
       * @type {{flagAdd: boolean, elements: string[], add: Function, remove: Function}}
       */
      var myNavBar = {
      
          flagAdd: true,
      
          elements: [],
      
          init: function (elements) {
              this.elements = elements;
          },
      
          add : function() {

            $( "#header-container" ).addClass( "fixed-theme" );  
            $('.navbar-brand img').attr('src', imgsmall);   
            $('#margintransition').css({
              'margin-top' : '30px'
            });
          },
      
          remove: function() {
            $( "#header-container" ).removeClass( "fixed-theme" );
            $('.navbar-brand img').attr('src', imglarge);   
            $('#margintransition')
            .delay(100)
            .queue(function (next) { 
              $(this).css({
                'margin-top' : '120px'
              }); 
              next(); 
            });
          }
      
      };
      
      /**
       * Init the object. Pass the object the array of elements
       * that we want to change when the scroll goes down
       */
      myNavBar.init(  [
          "header",
          "header-container",
          "brand"
      ]);
      
      /**
       * Function that manage the direction
       * of the scroll
       */
      function offSetManager(){
      
          var yOffset = 0;
          var currYOffSet = window.pageYOffset;
      
          if(yOffset < currYOffSet) {
              myNavBar.add();
          }
          else if(currYOffSet == yOffset){
              myNavBar.remove();
          }
      
      }
      
      /**
       * bind to the document scroll detection
       */
      window.onscroll = function(e) {
          offSetManager();
      }
      
      /**
       * We have to do a first detectation of offset because the page
       * could be load with scroll down set.
       */
      offSetManager();
    });
  }

  onSelect(id){
    this.router.navigate(['/page/president', id]);
  }
}
