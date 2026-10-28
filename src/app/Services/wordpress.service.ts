import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
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

  getSearch(searchVal:string): Observable<any[]> {
    return this.http.get<any[]>(this.baseUrl + 'posts?search=' + searchVal );
  }
}
