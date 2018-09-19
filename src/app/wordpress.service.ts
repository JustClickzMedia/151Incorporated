import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WordpressService {

  url: string;
  rtnval : Observable<any[]>;

  constructor(private http: HttpClient) { }

  getPosts(): Observable<any[]> {
    return this.http.get<any[]>('http://oxygen.1-5-1.org/wp-json/wp/v2/posts?_embed', {
      params: {
        per_page: '6'
      }
    });
  }

  getPost(id:string): Observable<any[]> {
    return this.http.get<any[]>('http://oxygen.1-5-1.org/wp-json/wp/v2/posts/' + id  + '?_embed');
  }

  getPages(): Observable<any[]> {
    return this.http.get<any[]>('http://oxygen.1-5-1.org/wp-json/wp/v2/pages?_embed&filter[orderby]=menu_order&order=asc', {
      params: {
        per_page: '6'
      }
    });
  }

  getPage(id:number): Observable<any[]> {
    return this.http.get<any[]>('http://oxygen.1-5-1.org/wp-json/wp/v2/pages/' + id + '?_embed');
  }
}
