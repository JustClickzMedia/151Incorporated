import { Routes } from '@angular/router';
import { HomeComponent } from './Components/home/home.component';
import { PostdetailsComponent } from './Components/postdetails/postdetails.component';
import { PagedetailsComponent } from './Components/pagedetails/pagedetails.component';
import { PagenotfoundComponent } from './Components/pagenotfound/pagenotfound.component';
import { DetailsComponent } from './Components/details/details.component';
import { SearchresultsComponent } from './Components/searchresults/searchresults.component';

export const routes: Routes = [
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
