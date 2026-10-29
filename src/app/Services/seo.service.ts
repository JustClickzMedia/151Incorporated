import { Injectable, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { Title } from '@angular/platform-browser';

/** Attribute selectors (no spaces around '=') for the tags added by addMetaTags() and setTitle(). */
export const META_TAGS_TO_REMOVE = [
  'name="author"',
  'name="date"',
  'http-equiv="Content-Type"',
  'charset',
  'property="og:title"',
  'property="og:type"',
] as const;

@Injectable({
  providedIn: 'root'
})
export class SeoService {
  private meta = inject(Meta);
  private titleService = inject(Title);


  constructor() {
    const meta = this.meta;
 
    meta.addTag({name: 'description', content: 'Title and Meta tags examples'});
    meta.addTag({name: 'viewport', content: 'width=device-width, initial-scale=1'}); 
  }

  setTitle(_title: string){
    this.titleService.setTitle(_title);
    this.updateTitleMetaTags(_title);
  }

  getTitle(){
    this.titleService.getTitle();
  }

  addMetaTags() {
    this.meta.addTags([
       {name: 'robots', content: 'INDEX, FOLLOW'},
       {name: 'author', content: 'Kenneth Elliott'},
       //{name: 'keywords', content: 'TypeScript, Angular'},
       {name: 'date', content: '2018-06-02', scheme: 'YYYY-MM-DD'},
       {httpEquiv: 'Content-Type', content: 'text/html'},
       //{property: 'og:title', content: "My Text"},
       {property: 'og:type', content: "website"},
       {charset: 'UTF-8'}
    ]);
  } 
  getMetaTags() {
      let metaEl: HTMLMetaElement = this.meta.getTag('name="keywords"');
      console.log(metaEl);
      console.log(metaEl.name);
      console.log(metaEl.content);

      let els: HTMLMetaElement[] = this.meta.getTags('name');
      els.forEach(el => {
        console.log(el);
        console.log(el.name);
        console.log(el.content);
      });
  }         
  updateDescMetaTags(desc : string) {
      this.meta.updateTag({name: 'description', content: desc});
  } 

  updateTitleMetaTags(desc : string) {
    this.meta.updateTag({property: 'og:title', content: desc});
  }
  
  updateKeywordMetaTags(desc : string) {
    this.meta.updateTag({name: 'keywords', content: desc});
  }

  removeMetaTags() {
      //Using removeTag
      /*this.meta.removeTag('name = "description"');        
      this.meta.removeTag('name= "keywords"');
      this.meta.removeTag('name = "viewport"');
      this.meta.removeTag('name = "robots"');*/
      
      // Removes the tags addMetaTags() adds, so they aren't duplicated on every navigation.
      // Selectors must have no spaces around '=': the server-side DOM (domino, used for SSR) throws
      // "op is not a function" on 'name = "author"'. The attribute is 'http-equiv', not 'httpEquiv'.
      // Removes every match, so duplicates left by earlier navigations are cleaned up too.
      for (const selector of META_TAGS_TO_REMOVE) {
        this.meta.getTags(selector).forEach(tag => this.meta.removeTagElement(tag));
      }
  }       
}
