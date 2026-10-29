import { Injectable, InjectionToken, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { GraphqlService } from './graphql.service';
import { PAGE_BY_SLUG, PAGES } from './wp-queries';
import { GqlPage, WpPage, WpPageLink, pageFromGraphql, pageFromRest } from '../Model/wp-page';

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

  getSearch(searchVal:string): Observable<any[]> {
    return this.http.get<any[]>(this.baseUrl + 'posts?search=' + searchVal );
  }
}
