import { Injectable } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { Title } from '@angular/platform-browser';

@Injectable({
  providedIn: 'root'
})
export class SeoService {

  constructor(private meta: Meta, private titleService: Title) { 
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
      let metaEl: HTMLMetaElement = this.meta.getTag('name= "keywords"');
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
      
      //Using removeTagElement
      let author: HTMLMetaElement = this.meta.getTag('name = "author"');
      this.meta.removeTagElement(author);
      let date: HTMLMetaElement = this.meta.getTag('name = "date"');
      this.meta.removeTagElement(date);
      let contentType: HTMLMetaElement = this.meta.getTag('httpEquiv = "Content-Type"');
      this.meta.removeTagElement(contentType);
      let charset: HTMLMetaElement = this.meta.getTag('charset');
      this.meta.removeTagElement(charset);
      let ogTitle: HTMLMetaElement = this.meta.getTag('property = "og:title"');
      this.meta.removeTagElement(ogTitle);
      let ogType: HTMLMetaElement = this.meta.getTag('property = "og:type"');          
      this.meta.removeTagElement(ogType);
  }       
}
