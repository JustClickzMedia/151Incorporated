import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { NavbarComponent } from './navbar.component';
import { environment } from '../../../environments/environment';
import { USE_GRAPHQL } from '../../Services/wordpress.service';

describe('NavbarComponent', () => {
  let fixture: ComponentFixture<NavbarComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavbarComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: USE_GRAPHQL, useValue: false }],
    }).compileComponents();
    fixture = TestBed.createComponent(NavbarComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('renders a menu item per WordPress page', async () => {
    http.expectOne(r => r.url.startsWith(environment.restUrl + 'pages?_embed'))
      .flush([{ id: 2, slug: 'membership', title: { rendered: 'Membership' } },
              { id: 3, slug: 'moto', title: { rendered: 'Moto' } }]);
    fixture.detectChanges();
    await fixture.whenStable();
    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.navbar-nav.mr-auto a'));
    expect(links.map(a => a.textContent?.trim())).toEqual(['MEMBERSHIP', 'MOTO']);
    expect(links.map(a => a.getAttribute('href'))).toEqual(['/pg/membership', '/pg/moto']);
  });

  it('is a regular horizontal menu on desktop (navbar-expand-lg: hamburger only below 992px)', () => {
    http.expectOne(r => r.url.startsWith(environment.restUrl + 'pages?_embed')).flush([]);
    const nav = (fixture.nativeElement as HTMLElement).querySelector('nav#header')!;
    expect(nav.classList).toContain('navbar-expand-lg');
  });

  it('has a burgundy header on every page, before and after scrolling (white links were invisible on white)', async () => {
    http.expectOne(r => r.url.startsWith(environment.restUrl + 'pages?_embed')).flush([]);
    document.body.appendChild(fixture.nativeElement);
    const header = (fixture.nativeElement as HTMLElement).querySelector('#header') as HTMLElement;
    expect(getComputedStyle(header).backgroundColor).toBe('rgb(103, 0, 1)');
    header.classList.add('bgnav'); // what the scroll handler adds
    expect(getComputedStyle(header).backgroundColor).toBe('rgb(103, 0, 1)');
    (fixture.nativeElement as HTMLElement).remove();
  });

  it('closes the phone menu after a page is chosen', async () => {
    http.expectOne(r => r.url.startsWith(environment.restUrl + 'pages?_embed'))
      .flush([{ id: 2, slug: 'membership', title: { rendered: 'Membership' } }]);
    fixture.componentInstance.toggleNavbar();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.navbarOpen()).toBeTrue();
    ((fixture.nativeElement as HTMLElement).querySelector('.navbar-nav.mr-auto a') as HTMLAnchorElement).click();
    expect(fixture.componentInstance.navbarOpen()).toBeFalse();
  });

  it('toggles the collapsed menu', async () => {
    http.expectOne(r => r.url.startsWith(environment.restUrl + 'pages?_embed')).flush([]);
    const collapse = () => (fixture.nativeElement as HTMLElement).querySelector('.navbar-collapse')!;
    fixture.detectChanges();
    expect(collapse().classList).not.toContain('show');
    fixture.componentInstance.toggleNavbar();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(collapse().classList).toContain('show');
  });
});

describe('NavbarComponent (GraphQL)', () => {
  it('renders the menu from the GraphQL Pages query, linking by slug', async () => {
    await TestBed.configureTestingModule({
      imports: [NavbarComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: USE_GRAPHQL, useValue: true }],
    }).compileComponents();
    const fixture = TestBed.createComponent(NavbarComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    const req = http.expectOne(r => r.method === 'POST' && r.url === environment.graphqlUrl);
    expect(req.request.body.query).toContain('pages(');
    req.flush({ data: { pages: { pageInfo: { hasNextPage: false, endCursor: null },
      nodes: [{ databaseId: 29, slug: 'membership', title: 'Membership Requirement', uri: '/membership/' },
              { databaseId: 17, slug: 'moto', title: 'Moto', uri: '/moto/' }] } } });
    fixture.detectChanges();
    await fixture.whenStable();
    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.navbar-nav.mr-auto a'));
    expect(links.map(a => a.textContent?.trim())).toEqual(['MEMBERSHIP', 'MOTO']);
    expect(links.map(a => a.getAttribute('href'))).toEqual(['/pg/membership', '/pg/moto']);
    http.verify();
  });
});
