import { NgtUniversalModule } from '@ng-toolkit/universal';
import { CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule }   from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { NavbarComponent } from './navbar/navbar.component';
import { CarouselComponent } from './carousel/carousel.component';
import { HomeComponent } from './home/home.component';
import { FooterComponent } from './footer/footer.component';
import { PostsComponent } from './posts/posts.component';
import { PagenotfoundComponent } from './pagenotfound/pagenotfound.component';
import { PresidentsComponent } from './presidents/presidents.component';
import { PostdetailsComponent } from './postdetails/postdetails.component';
import { HomebuttonsectionComponent } from './homebuttonsection/homebuttonsection.component';
import { TargetsComponent } from './targets/targets.component';
import { HomeNewsComponent } from './home-news/home-news.component';
import { PagedetailsComponent } from './pagedetails/pagedetails.component';
import { DetailsComponent } from './details/details.component';
import { SidbarpostsComponent } from './sidbarposts/sidbarposts.component';
import { FilterPipe } from './filter.pipe';
import { SearchboxComponent } from './searchbox/searchbox.component';
import { SearchresultsComponent } from './searchresults/searchresults.component';

@NgModule({
  declarations: [
    AppComponent,
    NavbarComponent,
    CarouselComponent,
    HomeComponent,
    FooterComponent,
    PostsComponent,
    PagenotfoundComponent,
    PresidentsComponent,
    PostdetailsComponent,
    HomebuttonsectionComponent,
    TargetsComponent,
    HomeNewsComponent,
    PagedetailsComponent,
    DetailsComponent,
    SidbarpostsComponent,
    FilterPipe,
    SearchboxComponent,
    SearchresultsComponent
  ],
  imports:[
    CommonModule,
    NgtUniversalModule,    
    AppRoutingModule,
    HttpClientModule,
    FormsModule
  ],
  providers: [],
})
export class AppModule { }
