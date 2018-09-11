import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { PostdetailsComponent } from './postdetails/postdetails.component';
import { PagedetailsComponent } from './pagedetails/pagedetails.component';
import { PagenotfoundComponent } from './pagenotfound/pagenotfound.component'

const routes: Routes = [
  {
    path : '',
    component : HomeComponent
  },
  {
    path : 'president',
    component : PagedetailsComponent
      
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
