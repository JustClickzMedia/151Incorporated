import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class WordpressService {
  private http = inject(HttpClient);


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
   * Look up a page by slug (REST: pages?slug=...). Emits the page, or undefined when no page has that slug.
   * Replaces ID-based lookups such as page 13, which doesn't exist.
   */
  getPageBySlug(slug: string): Observable<any | undefined> {
    return this.http.get<any[]>(this.baseUrl + 'pages', { params: { slug, _embed: '' } })
      .pipe(map(pages => pages?.[0]));
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
