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
import { BlogComponent } from './Components/blog/blog.component';
import { BlogpostComponent } from './Components/blogpost/blogpost.component';

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
        // Old page links /pg/<slug> (before 2026-11-02): send them to /<slug>, so bookmarks and search results keep working
        path : 'pg/:slug',
        redirectTo : '/:slug'
      },
      {
        // Oldest links (/pg/19/1-5-1 History): look the ID up and redirect to /<slug>, or show the 404 view
        path : 'pg/:id/:title',
        canActivate : [legacyPageRedirectGuard],
        children : []
      },
      {
        // Blog: all posts, list or grid view (menu UPDATE → Blog)
        path : 'blog',
        component : BlogComponent
      },
      {
        // One blog post, e.g. /blog/a-new-chapter-in-our-digital-brotherhood-...
        path : 'blog/:slug',
        component : BlogpostComponent
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
        // WordPress pages by slug at the top level, e.g. /about-1-5-1, /membership. Must stay after every
        // fixed route above (blog, events, 404, ...): a WordPress page with one of those slugs would be hidden.
        path : ':slug',
        component : DetailsComponent
      },
      {
        path : '**',
        component : PagenotfoundComponent
      }
];
