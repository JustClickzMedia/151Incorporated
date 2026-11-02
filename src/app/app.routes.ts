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
import { guestGuard, memberGuard } from './Services/portal/member.guard';

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
      // Members area (docs/members-portal/ANGULAR-INTEGRATION.md). Loaded only when visited; never prerendered.
      {
        path : 'members/sign-in',
        canActivate : [guestGuard],
        loadComponent : () => import('./Components/members/sign-in/sign-in.component').then(m => m.SignInComponent)
      },
      {
        path : 'members/reset-password',
        loadComponent : () => import('./Components/members/reset-password/reset-password.component').then(m => m.ResetPasswordComponent)
      },
      {
        path : 'members',
        canActivate : [memberGuard],
        loadComponent : () => import('./Components/members/layout/members-layout.component').then(m => m.MembersLayoutComponent),
        children : [
          { path : '', loadComponent : () => import('./Components/members/dashboard/dashboard.component').then(m => m.DashboardComponent) },
          { path : 'events', loadComponent : () => import('./Components/members/events/events.component').then(m => m.MemberEventsComponent) },
          { path : 'events/:id', loadComponent : () => import('./Components/members/event-detail/event-detail.component').then(m => m.MemberEventDetailComponent) },
          { path : 'announcements', loadComponent : () => import('./Components/members/announcements/announcements.component').then(m => m.MemberAnnouncementsComponent) },
          { path : 'resources', loadComponent : () => import('./Components/members/resources/resources.component').then(m => m.MemberResourcesComponent) },
          { path : 'directory', loadComponent : () => import('./Components/members/directory/directory.component').then(m => m.MemberDirectoryComponent) },
          { path : 'directory/:id', loadComponent : () => import('./Components/members/brother/brother.component').then(m => m.BrotherComponent) },
          { path : 'profile', loadComponent : () => import('./Components/members/profile/profile.component').then(m => m.ProfileComponent) },
          { path : '**', redirectTo : '' },
        ]
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
