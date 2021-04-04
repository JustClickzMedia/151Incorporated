import { Injectable } from '@angular/core';
import * as flamelink from 'flamelink';
import firebase from "firebase/app";
import "firebase/firestore";
import "firebase/database";
import { Observable, bindNodeCallback} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FlamelinkService {

  app : flamelink.App;

  constructor() { 
    const firebaseConfig = {
      apiKey: "AIzaSyCXazDZNDG4XTTIBxImsGTF1YQbtGWduW0",
      authDomain: "project-5901963511642186417.firebaseapp.com",
      projectId: "project-5901963511642186417",
      storageBucket: "project-5901963511642186417.appspot.com",
      messagingSenderId: "1096763303651",
      appId: "1:1096763303651:web:59d8f7a8ef511a44e2c7d6",
      measurementId: "G-EZDT1CB52E"
    };
    
    const firebaseApp = firebase.initializeApp(firebaseConfig);
    
    this.app = flamelink({ firebaseApp });
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

  getPresidentMes(): Observable<any[]> {
    const getContentObservable = bindNodeCallback(this.app.content.subscribe);
    return getContentObservable.call('president', { fields: [ 'title', 'content' ] }) // make sure methodWithCallback has access to someObject
    .subscribe(
      x => console.log('Individual Presidents with options applied:', x),
      err => console.error('Something went wrong while retrieving the entry. Details:', err),
    );
  };
}

