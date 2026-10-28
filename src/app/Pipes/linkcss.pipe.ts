import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'linkcss',
    standalone: true
})
export class LinkcssPipe implements PipeTransform {

  /** Appends a "Continue Read More..." link to the page's slug URL (/pg/<slug>). */
  transform(excerpt: string, slug: string) {
    return excerpt + '<a  href="/pg/' + encodeURIComponent(slug ?? '') + '">Continue Read More...</a>';
  }
}
