import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { routes } from './app.routes';
import { DetailsComponent } from './Components/details/details.component';
import { EventslistComponent } from './Components/eventslist/eventslist.component';
import { BlogComponent } from './Components/blog/blog.component';
import { PagenotfoundComponent } from './Components/pagenotfound/pagenotfound.component';

describe('app routes: WordPress pages at the top level (no /pg)', () => {
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    harness = await RouterTestingHarness.create();
  });

  it('/membership shows the WordPress page "membership"', async () => {
    expect(await harness.navigateByUrl('/membership')).toBeInstanceOf(DetailsComponent);
    expect(TestBed.inject(Router).url).toBe('/membership');
  });

  it('old /pg/<slug> links redirect to /<slug>', async () => {
    expect(await harness.navigateByUrl('/pg/about-1-5-1')).toBeInstanceOf(DetailsComponent);
    expect(TestBed.inject(Router).url).toBe('/about-1-5-1');
  });

  it('fixed pages still win over page slugs', async () => {
    expect(await harness.navigateByUrl('/events')).toBeInstanceOf(EventslistComponent);
    expect(await harness.navigateByUrl('/blog')).toBeInstanceOf(BlogComponent);
    expect(await harness.navigateByUrl('/404')).toBeInstanceOf(PagenotfoundComponent);
  });

  it('deeper unknown addresses still show the 404 view', async () => {
    expect(await harness.navigateByUrl('/a/b/c')).toBeInstanceOf(PagenotfoundComponent);
  });
});
