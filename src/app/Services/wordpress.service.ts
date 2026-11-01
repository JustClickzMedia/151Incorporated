import { Injectable, InjectionToken, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { GraphqlError, GraphqlService } from './graphql.service';
import { EVENTS, EVENTS_BASIC, EVENT_BY_SLUG, EVENT_BY_SLUG_BASIC, HOMEPAGE_CAROUSELS, PAGE_BY_SLUG, PAGES } from './wp-queries';
import { GqlEvent, WpEvent, eventFromGraphql } from '../Model/wp-event';
import { GqlPage, WpPage, WpPageLink, pageFromGraphql, pageFromRest } from '../Model/wp-page';
import { CarouselSlide, GqlHomepageCarousel, slideFromGraphql } from '../Model/carousel-slide';

/**
 * true = read pages through GraphQL, false = REST. Defaults to environment.useGraphql
 * (on for staging/dev, off for production until the backend promotes staging -> production).
 */
export const USE_GRAPHQL = new InjectionToken<boolean>('USE_GRAPHQL', {
  providedIn: 'root',
  factory: () => environment.useGraphql,
});

@Injectable({
  providedIn: 'root'
})
export class WordpressService {
  private http = inject(HttpClient);
  private gql = inject(GraphqlService);
  private useGraphql = inject(USE_GRAPHQL);
  private isServer = isPlatformServer(inject(PLATFORM_ID));


  // REST base comes from environment.ts / environment.prod.ts (kept until GraphQL replacements are verified)
  baseUrl: string = environment.restUrl;
  url: string;
  rtnval : Observable<any[]>;

  getPosts(): Observable<any[]> {
    return this.http.get<any[]>(this.baseUrl + 'posts?_embed', {
      params: {
        per_page: '6'
      }
    });
  }

  getPost(id:number): Observable<any[]> {
    return this.http.get<any[]>(this.baseUrl + 'posts/' + id  + '?_embed');
  }

  getPages(): Observable<any[]> {
    return this.http.get<any[]>(this.baseUrl + 'pages?_embed&filter[orderby]=menu_order&order=asc', {
      params: {
        per_page: '6'
      }
    });
  }

  getPage(id:number): Observable<any[]> {
    return this.http.get<any[]>(this.baseUrl + 'pages/' + id + '?_embed');
  }

  /**
   * Pages for the navigation menu (id, slug, title), in menu order.
   * GraphQL: Pages query (first 20). REST: getPages() (first 6, as before).
   */
  getMenuPages(): Observable<WpPageLink[]> {
    if (this.useGraphql) {
      return this.gql.query<{ pages: { nodes: { databaseId: number; slug: string; title: string | null }[] } }>(PAGES, { first: 20 })
        .pipe(map(d => (d.pages?.nodes ?? []).map(n => ({ id: n.databaseId, slug: n.slug, title: n.title ?? '' }))));
    }
    return this.getPages().pipe(map(pages => (pages ?? []).map(p => ({ id: p.id, slug: p.slug, title: p.title?.rendered ?? '' }))));
  }

  /**
   * Look up a page by slug. Emits the page, or undefined when no page has that slug.
   * GraphQL: page(id: $slug, idType: URI) (null = not found). REST: pages?slug=...&_embed.
   * Replaces ID-based lookups such as page 13, which doesn't exist.
   */
  getPageBySlug(slug: string): Observable<WpPage | undefined> {
    if (this.useGraphql) {
      return this.gql.query<{ page: GqlPage | null }>(PAGE_BY_SLUG, { slug })
        .pipe(map(d => d.page ? pageFromGraphql(d.page) : undefined));
    }
    return this.http.get<any[]>(this.baseUrl + 'pages', { params: { slug, _embed: '' } })
      .pipe(map(pages => pages?.[0] ? pageFromRest(pages[0]) : undefined));
  }

  /**
   * Slug of the page with this WordPress ID (REST: pages/<id>?_fields=slug). Used only to redirect
   * old /pg/<id>/<title> links. Errors (e.g. 404 rest_post_invalid_id for page 13) are passed on.
   */
  getPageSlugById(id: number): Observable<string | undefined> {
    return this.http.get<{ slug?: string }>(this.baseUrl + 'pages/' + id, { params: { _fields: 'slug' } })
      .pipe(map(page => page?.slug || undefined));
  }

  private carousel$?: Observable<CarouselSlide[]>;

  /**
   * Homepage carousel slides (GraphQL homepageCarousels; there is no REST equivalent).
   * Emits [] when GraphQL is off (production until promotion), so the caller keeps its static slides.
   * The result is cached for the session, so returning to the homepage doesn't refetch; a failed
   * request is not cached.
   */
  getHomepageCarousels(): Observable<CarouselSlide[]> {
    if (!this.useGraphql) {
      return of([]);
    }
    // shareReplay keeps the result for the session; it resets on error, so a failed request isn't cached.
    this.carousel$ ??= this.gql.query<{ homepageCarousels: { nodes: GqlHomepageCarousel[] } | null }>(HOMEPAGE_CAROUSELS)
      .pipe(
        map(d => (d.homepageCarousels?.nodes ?? [])
          .map(slideFromGraphql)
          .filter((slide): slide is CarouselSlide => !!slide)),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    return this.carousel$;
  }

  /**
   * Published events (newest first from WordPress; the homepage decides which are current).
   * Never fetched while prerendering: the homepage is prerendered at build time, and events must reflect
   * WordPress (and today's date) when the visitor opens the page, not when the site was built.
   * Emits [] when GraphQL is off. Retries without the optional ACF eventDetails group if it doesn't exist yet.
   */
  getEvents(): Observable<WpEvent[]> {
    if (!this.useGraphql || this.isServer) {
      return of([]);
    }
    type Res = { events: { nodes: GqlEvent[] } | null };
    return this.withBasicFallback(
      this.gql.query<Res>(EVENTS),
      () => this.gql.query<Res>(EVENTS_BASIC)
    ).pipe(map(d => (d.events?.nodes ?? []).map(eventFromGraphql)));
  }

  /** One event by its WordPress slug; undefined when there is none. */
  getEventBySlug(slug: string): Observable<WpEvent | undefined> {
    if (!this.useGraphql) {
      return of(undefined);
    }
    type Res = { event: GqlEvent | null };
    return this.withBasicFallback(
      this.gql.query<Res>(EVENT_BY_SLUG, { slug }),
      () => this.gql.query<Res>(EVENT_BY_SLUG_BASIC, { slug })
    ).pipe(map(d => d.event ? eventFromGraphql(d.event) : undefined));
  }

  /** Run `full`; if WordPress has no eventDetails ACF group yet, run `basic` instead. Other errors pass through. */
  private withBasicFallback<T>(full: Observable<T>, basic: () => Observable<T>): Observable<T> {
    return full.pipe(catchError(err =>
      err instanceof GraphqlError && err.errors.some(e => e.message.includes('"eventDetails"'))
        ? basic()
        : throwError(() => err)));
  }

  getSearch(searchVal:string): Observable<any[]> {
    return this.http.get<any[]>(this.baseUrl + 'posts?search=' + searchVal );
  }
}
