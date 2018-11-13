import { NgtUniversalModule } from '@ng-toolkit/universal';
import { CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule }   from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { NavbarComponent } from './Components/navbar/navbar.component';
import { CarouselComponent } from './Components/carousel/carousel.component';
import { HomeComponent } from './Components/home/home.component';
import { FooterComponent } from './Components/footer/footer.component';
import { PagenotfoundComponent } from './Components/pagenotfound/pagenotfound.component';
import { PresidentsComponent } from './Components/presidents/presidents.component';
import { PostdetailsComponent } from './Components/postdetails/postdetails.component';
import { HomebuttonsectionComponent } from './Components/homebuttonsection/homebuttonsection.component';
import { PagedetailsComponent } from './Components/pagedetails/pagedetails.component';
import { DetailsComponent } from './Components/details/details.component';
import { SidbarpostsComponent } from './Components/sidbarposts/sidbarposts.component';
import { SearchboxComponent } from './Components/searchbox/searchbox.component';
import { SearchresultsComponent } from './Components/searchresults/searchresults.component';
import { FilterPipe } from './Pipes/filter.pipe';
import { LinkcssPipe } from './Pipes/linkcss.pipe';

@NgModule({
  declarations: [
    AppComponent,
    NavbarComponent,
    CarouselComponent,
    HomeComponent,
    FooterComponent,
    PagenotfoundComponent,
    PresidentsComponent,  
    PostdetailsComponent,
    HomebuttonsectionComponent,
    PagedetailsComponent,
    DetailsComponent,
    SidbarpostsComponent,
    FilterPipe,
    SearchboxComponent,
    SearchresultsComponent,
    LinkcssPipe
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
