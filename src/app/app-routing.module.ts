import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { PostdetailsComponent } from './postdetails/postdetails.component';
import { PagedetailsComponent } from './pagedetails/pagedetails.component';
import { PagenotfoundComponent } from './pagenotfound/pagenotfound.component';
import { DetailsComponent } from './details/details.component';
import { SearchresultsComponent } from './searchresults/searchresults.component';

const routes: Routes = [
  {
    path : '',
    component : HomeComponent
  },
  {
    path : 'search/:term',
    component : SearchresultsComponent
      
  },
  {
    path : 'pg/:id/:title',
    component : DetailsComponent
      
  },
  {
    path : 'pst/:id/:title',
    component : PostdetailsComponent
  },
  {
    path : '**',
    component : PagenotfoundComponent
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
