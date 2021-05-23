import { Injectable } from '@angular/core';
import * as flamelink from 'flamelink';
import firebase from "firebase/app";
import "firebase/firestore";
import "firebase/database";
import 'firebase/storage';
import 'firebase/auth';
import { environment } from '../../environments/environment';
import { Observable, bindNodeCallback} from 'rxjs';
import { promise } from 'selenium-webdriver';

@Injectable({
  providedIn: 'root'
})
export class FlamelinkService {

  app : flamelink.App;

  constructor() { 
    const firebaseApp = firebase.initializeApp(environment.firebase);
    
    this.app = flamelink({ firebaseApp });
    console.log('flamelink initialized');
  }

  getCarouselImages(): Observable<any[]> {
    const getContentObservable = bindNodeCallback(this.app.content.subscribe);
    return getContentObservable.call('Carousel') // make sure methodWithCallback has access to someObject
    .subscribe(
      x => console.log('Individual Carousel images:', x),
      err => console.error('Something went wrong while retrieving the entry. Details:', err),
    );
  };

  getPresidentPostById(id:string): Observable<any[]> {
    const getContentObservable = bindNodeCallback(this.app.content.subscribe);
    return getContentObservable.call('president', id, { fields: [ 'title', 'content', 'imageDeck', 'seo' ] }) // make sure methodWithCallback has access to someObject
    .subscribe(
      x => console.log('Individual Carousel images:', x),
      err => console.error('Something went wrong while retrieving the entry. Details:', err),
    );
  };

  getNewPostById(id:string): Observable<any[]> {
    const getContentObservable = bindNodeCallback(this.app.content.subscribe);
    return getContentObservable.call('newsUpcomingEvents', id, { fields: [ 'title', 'content', 'imageDeck', 'seo' ] }) // make sure methodWithCallback has access to someObject
    .subscribe(
      x => console.log('Individual news Upcoming Events with options applied:', x),
      err => console.error('Something went wrong while retrieving the entry. Details:', err),
    );
  };

  getNewsPosts(): Observable<any[]> {
    const getContentObservable = bindNodeCallback(this.app.content.subscribe);
    return getContentObservable.call('newsUpcomingEvents', { fields: [ 'title', 'content', 'imageDeck', 'seo' ] }) // make sure methodWithCallback has access to someObject
    .subscribe(
      x => console.log('Individual news Upcoming Events with options applied:', x),
      err => console.error('Something went wrong while retrieving the entry. Details:', err),
    );
  };

  getMotoPost(): Observable<any[]> {
    const getContentObservable = bindNodeCallback(this.app.content.subscribe);
    return getContentObservable.call('motto', { fields: [ 'title', 'content', 'imageDeck', 'seo' ] }) // make sure methodWithCallback has access to someObject
    .subscribe(
      x => console.log('Individual motto with options applied:', x),
      err => console.error('Something went wrong while retrieving the entry. Details:', err),
    );
  };

  getFoundationPost(): Observable<any[]> {
    const getContentObservable = bindNodeCallback(this.app.content.subscribe);
    return getContentObservable.call('foundation', { fields: [ 'title', 'content', 'imageDeck', 'seo' ] }) // make sure methodWithCallback has access to someObject
    .subscribe(
      x => console.log('Individual foundation with options applied:', x),
      err => console.error('Something went wrong while retrieving the entry. Details:', err),
    );
  };

  getStrategicObjPost(): Observable<any[]> {
    const getContentObservable = bindNodeCallback(this.app.content.subscribe);
    return getContentObservable.call('strategicObjectives', { fields: [ 'title', 'content', 'imageDeck', 'seo' ] }) // make sure methodWithCallback has access to someObject
    .subscribe(
      x => console.log('Individual strategic Objectives with options applied:', x),
      err => console.error('Something went wrong while retrieving the entry. Details:', err),
    );
  };

  gethistoryPost(): Observable<any[]> {
    const getContentObservable = bindNodeCallback(this.app.content.subscribe);
    return getContentObservable.call('history', { fields: [ 'title', 'content', 'imageDeck', 'seo' ] }) // make sure methodWithCallback has access to someObject
    .subscribe(
      x => console.log('Individual history with options applied:', x),
      err => console.error('Something went wrong while retrieving the entry. Details:', err),
    );
  };

  getPresidentMesById(id:string): Observable<any[]> {
    const getContentObservable = bindNodeCallback(this.app.content.subscribe);
    return getContentObservable.call('president', id, { fields: [ 'title', 'content', 'imageDeck', 'seo' ] }) // make sure methodWithCallback has access to someObject
    .subscribe(
      x => console.log('Individual president with options applied:', x),
      err => console.error('Something went wrong while retrieving the entry. Details:', err),
    );
  };

  /* getPresidentMes(): Observable<any[]> {
    console.log("accessing president");
    const blogPosts = this.app.content.get({schemaKey: 'president'})
    console.log('All the blog posts:', blogPosts);

    const getContentObservable = bindNodeCallback(this.app.content.subscribe);
    return getContentObservable.call({schemaKey: 'president'}) // make sure methodWithCallback has access to someObject
    .subscribe(
      x => console.log('Individual Presidents with options applied:', x),
      err => console.error('Something went wrong while retrieving the entry. Details:', err),
    );
  }; */

  async getPresidentMes(): Promise<object> {
    console.log("Testing connection");
    
    const test = await this.app.content.get('president');

    console.log("this is the test value", test);

    return test;

    

    /* console.log("accessing president");
    return this.app.content.get('president') // make sure methodWithCallback has access to someObject
                .then(val => {
                  console.log("In then",val);
                  return val;
                }); */
  };
}

