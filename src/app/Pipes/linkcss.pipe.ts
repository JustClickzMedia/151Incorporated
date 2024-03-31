import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'linkcss',
    standalone: true
})
export class LinkcssPipe implements PipeTransform {

  constructor() { } 
  
  transform(excerpt:string, id:string, title:string) {
    let termsApply = excerpt + '<a  href="/pg/'+ id + '/'  + title + '">Continue Read More...</a>'; 
    
    return termsApply;
  }
}
