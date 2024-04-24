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
  imglarge = "https://tzin.brothersof1-5-1.org/wp-content/uploads/2024/04/brother151logo2-1.png";
  imgsmall = "https://tzin.brothersof1-5-1.org/wp-content/uploads/2024/04/Brothers-of-1-5-1-Incorporated-219-x-52-px-1.png";
  elheader = null;
  element = null;
  transitionelement = null;
  container = null;

  constructor(@Inject(DOCUMENT) private document: Document,
              private router: Router,
              private wp: WordpressService) { 
    this.elheader = document.getElementById('header');
    this.element = document.getElementById('header-container');
    this.transitionelement = document.getElementById('margintransition');
    this.container = document.querySelectorAll('.navbar-brand img');
  }

  search(term: string): void {
    console.log('searchterm: ' + term);
  }

  toggleNavbar() {
    this.navbarOpen = !this.navbarOpen;
    if(this.navbarOpen){
      this.togglesmallmenu();
    }
    else{
      this.togglelargemenu()
    }
  }

  @HostListener('document:scroll',['$event'])
  public onViewportScroll() {
    var yOffset = 0
    var currYOffSet = window.pageYOffset;
   
    var elheader = document.getElementById('header');
    var element = document.getElementById('header-container');
    var transitionelement = document.getElementById('margintransition');
    var container = document.querySelectorAll('.navbar-brand img')
    if(yOffset < currYOffSet) {
      this.togglesmallmenu();
    }
    else if(currYOffSet == yOffset){
      if(!this.navbarOpen){
        this.togglelargemenu();
      }
    }
  }

  public togglesmallmenu(){
    this.elheader.classList.add('bgnav');
    this.element.classList.add('fixed-theme');
    this.buttonbrdcolor = 'rgb(103,0,1)';
    this.iconlnimage = "url(\"data:image/svg+xml;charset=utf8,%3Csvg viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath stroke='rgba(103,0,1,1)' stroke-width='2' stroke-linecap='round' stroke-miterlimit='10' d='M4 8h24M4 16h24M4 24h24'/%3E%3C/svg%3E\")";
    this.container[0].setAttribute('src', this.imgsmall);
  }

  public togglelargemenu(){
    this.elheader.classList.remove('bgnav');
    this.element.classList.remove('fixed-theme');
    this.buttonbrdcolor = 'rgb(255,255,255)';
    this.iconlnimage = "url(\"data:image/svg+xml;charset=utf8,%3Csvg viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath stroke='rgba(255,255,255,0.7)' stroke-width='2' stroke-linecap='round' stroke-miterlimit='10' d='M4 8h24M4 16h24M4 24h24'/%3E%3C/svg%3E\")";
    this.container[0].setAttribute('src', this.imglarge);
    setTimeout(this.setDelay, 100);
  }

  public setDelay() {
    var transitionelement = document.getElementById('margintransition');
    //transitionelement.style.marginTop = '120px';
  }

  ngOnInit() {
    this.NavMenu$ = this.wp.getPages();
  }

  onSelect(id){
    this.router.navigate(['/page/president', id]);
  }

  
}
