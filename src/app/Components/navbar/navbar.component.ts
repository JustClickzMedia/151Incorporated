import { Component, HostListener, OnInit, DOCUMENT, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';

import { WordpressService } from '../../Services/wordpress.service';
import { withFallback } from '../../Services/rx-fallback';
import { WpPageLink } from '../../Model/wp-page';
import { CommonModule } from '@angular/common'
import { RouterLinkActive, RouterLink } from '@angular/router';
//import { SearchboxComponent } from '../../Components/searchbox/searchbox.component'

/** The Membership page is shown inside the MEMBERSHIP dropdown at the end of the menu. */
export const MEMBERSHIP_SLUG = 'membership';

/** Menu labels that differ from the page slug. */
export const NAV_LABELS: Record<string, string> = {
  'about-1-5-1': 'About',
};

@Component({
    selector: 'app-navbar',
    templateUrl: './navbar.component.html',
    styleUrls: ['./navbar.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [CommonModule, RouterLinkActive, RouterLink]
})
export class NavbarComponent implements OnInit {
  private document = inject<Document>(DOCUMENT);
  private router = inject(Router);
  private wp = inject(WordpressService);


 
  logo:any = "/images/151Logo.png";
  readonly NavMenu = toSignal(this.wp.getMenuPages().pipe(withFallback<WpPageLink[]>([])), { initialValue: [] as WpPageLink[] });
  readonly navbarOpen = signal(false);
  /** The Membership dropdown (Membership page + Pay Dues). */
  readonly membershipOpen = signal(false);
  private readonly currentUrl = signal(this.router.url);
  /** Highlight MEMBERSHIP while the Membership page is open. */
  readonly membershipActive = computed(() => this.currentUrl().startsWith('/pg/membership'));
  /** WordPress pages for the menu, without Membership (it is the dropdown at the end). */
  readonly pageMenu = computed(() => this.NavMenu().filter(p => p.slug !== MEMBERSHIP_SLUG));

  constructor() {
    this.router.events.subscribe(e => { if (e instanceof NavigationEnd) { this.currentUrl.set(e.urlAfterRedirects); } });
  }
  readonly buttonbrdcolor = signal('rgb(103,0,1)'); // maroon on the white header at the top of the page
  readonly iconlnimage = signal('');

  search(term: string): void {
    console.log('searchterm: ' + term);
  }

  toggleNavbar() {
    this.navbarOpen.update(open => !open);
  }

  /** Menu text for a page: its slug, except where a shorter label reads better (about-1-5-1 -> About). */
  menuLabel(item: WpPageLink): string {
    return NAV_LABELS[item.slug] ?? item.slug;
  }

  toggleMembership(event: Event) {
    event.stopPropagation();
    this.membershipOpen.update(open => !open);
  }

  /** Close the Membership dropdown when clicking anywhere else, or pressing Escape. */
  @HostListener('document:click')
  @HostListener('document:keydown.escape')
  closeMembership() {
    this.membershipOpen.set(false);
  }

  /** After choosing a page, close the phone/tablet menu (on desktop the menu is always visible). */
  closeNavbar() {
    this.navbarOpen.set(false);
    this.membershipOpen.set(false);
  }

  @HostListener('document:scroll')
  public onViewportScroll() {
    var yOffset = 0
    var currYOffSet = window.pageYOffset;
    // Two header looks: at the very top a WHITE header with the dark-text logo; once scrolled a BURGUNDY
    // header (.bgnav) with the white-text logo. Colours are in navbar.component.css.
    var imglarge = "https://tzin.brothersof1-5-1.org/wp-content/uploads/2024/04/brother151logo2-1.png";
    var imgsmall = "https://tzin.brothersof1-5-1.org/wp-content/uploads/2024/04/Brothers-of-1-5-1-Incorporated-219-x-52-px-1.png";
    var imgsmall = "https://tzin.brothersof1-5-1.org/wp-content/uploads/2024/04/Brothers-of-1-5-1-Incorporated-219-x-52-px-1.png";
    
    var elheader = document.getElementById('header');
    var element = document.getElementById('header-container');
    var transitionelement = document.getElementById('margintransition');
    var container = document.querySelectorAll('.navbar-brand img')
    if(yOffset < currYOffSet) {
      elheader.classList.add('bgnav');
      element.classList.add('fixed-theme');
      this.buttonbrdcolor.set('rgb(255,255,255)');
      this.iconlnimage.set('test');
      //"background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath stroke='rgba(103,0,1,1)' stroke-width='2' stroke-linecap='round' stroke-miterlimit='10' d='M4 8h24M4 16h24M4 24h24'/%3E%3C/svg%3E\")";
      container[0].setAttribute('src', imglarge);
      if (transitionelement) { transitionelement.style.marginTop = '30px'; } // only page views have #margintransition
    }
    else if(currYOffSet == yOffset){
      elheader.classList.remove('bgnav');
      element.classList.remove('fixed-theme');
      this.buttonbrdcolor.set('rgb(103,0,1)');
      this.iconlnimage.set('test');
      //'background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath stroke='rgba(255,255,255,0.7)' stroke-width='2' stroke-linecap='round' stroke-miterlimit='10' d='M4 8h24M4 16h24M4 24h24'/%3E%3C/svg%3E\")';
      container[0].setAttribute('src', imgsmall);
      setTimeout(this.setDelay, 100);
    }
  }

  public setDelay() {
    var transitionelement = document.getElementById('margintransition');
    if (transitionelement) { transitionelement.style.marginTop = '120px'; } // not on the homepage
  }

  ngOnInit() {
    
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
