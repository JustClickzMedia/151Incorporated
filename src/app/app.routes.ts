import { Routes } from '@angular/router';
import { HomeComponent } from './Components/home/home.component';
import { PostdetailsComponent } from './Components/postdetails/postdetails.component';
import { PagedetailsComponent } from './Components/pagedetails/pagedetails.component';
import { PagenotfoundComponent } from './Components/pagenotfound/pagenotfound.component';
import { DetailsComponent } from './Components/details/details.component';
import { SearchresultsComponent } from './Components/searchresults/searchresults.component';
import { legacyPageRedirectGuard } from './legacy-page-redirect.guard';
import { EventdetailsComponent } from './Components/eventdetails/eventdetails.component';
import { EventslistComponent } from './Components/eventslist/eventslist.component';

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
        // WordPress pages are addressed by slug, e.g. /pg/about-1-5-1
        path : 'pg/:slug',
        component : DetailsComponent
      },
      {
        // Old links (/pg/19/1-5-1 History): look the ID up and redirect to /pg/<slug>, or show the 404 view
        path : 'pg/:id/:title',
        canActivate : [legacyPageRedirectGuard],
        children : []
      },
      {
        // All current events, list or grid view (menu UPDATE → Events)
        path : 'events',
        component : EventslistComponent
      },
      {
        // One WordPress event, e.g. /event/got-skillz-6-is-back-the-ultimate-summer-spades-bid-whist-showdown
        path : 'event/:slug',
        component : EventdetailsComponent
      },
      {
        path : '404',
        component : PagenotfoundComponent
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
