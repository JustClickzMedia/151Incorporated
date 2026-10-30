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

  it('menu order: HOME first, then the WordPress pages, then MEMBERSHIP last', async () => {
    http.expectOne(r => r.url.startsWith(environment.restUrl + 'pages?_embed'))
      .flush([{ id: 2, slug: 'membership', title: { rendered: 'Membership' } },
              { id: 3, slug: 'moto', title: { rendered: 'Moto' } }]);
    fixture.detectChanges();
    await fixture.whenStable();
    const items = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.navbar-nav.mr-auto > li > .nav-link'));
    expect(items.map(a => a.textContent?.trim())).toEqual(['HOME', 'MOTO', 'MEMBERSHIP']);
    expect(items.map(a => a.getAttribute('href'))).toEqual(['/', '/pg/moto', null]); // MEMBERSHIP is the dropdown button
  });

  it('MEMBERSHIP opens a dropdown with the Membership page and Pay Dues; it closes on an outside click or Escape', async () => {
    http.expectOne(r => r.url.startsWith(environment.restUrl + 'pages?_embed')).flush([]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const toggle = el.querySelector('#membership-toggle') as HTMLButtonElement;
    const menu = () => el.querySelector('#membership-menu') as HTMLElement;
    expect(menu().classList).not.toContain('show');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    toggle.click();
    fixture.detectChanges();
    expect(menu().classList).toContain('show');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const items = Array.from(menu().querySelectorAll('a')) as HTMLAnchorElement[];
    expect(items.map(a => a.textContent?.trim())).toEqual(['Membership Requirements', 'Pay Dues']);
    expect(items[0].getAttribute('href')).toBe('/pg/membership');
    expect(items[1].href).toContain('checkout.square.site');
    expect(items[1].target).toBe('_blank');
    expect(items[1].rel).toContain('noopener');

    document.body.click();
    fixture.detectChanges();
    expect(menu().classList).not.toContain('show');

    toggle.click();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(menu().classList).not.toContain('show');
  });

  it('has no PAY DUES or GIVE BACK buttons in the header any more', () => {
    http.expectOne(r => r.url.startsWith(environment.restUrl + 'pages?_embed')).flush([]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.navbar-buttons')).toBeNull();
    const texts = Array.from(el.querySelectorAll('#header a.btn')).map(a => a.textContent?.trim());
    expect(texts).toEqual([]);
  });

  it('the MEMBERSHIP button uses the same font as the other menu links', async () => {
    http.expectOne(r => r.url.startsWith(environment.restUrl + 'pages?_embed'))
      .flush([{ id: 3, slug: 'moto', title: { rendered: 'Moto' } }]);
    fixture.detectChanges();
    await fixture.whenStable();
    document.body.appendChild(fixture.nativeElement);
    const el = fixture.nativeElement as HTMLElement;
    const link = getComputedStyle(el.querySelector('.navbar-nav.mr-auto > li > a.nav-link')!);
    const button = getComputedStyle(el.querySelector('#membership-toggle')!);
    for (const prop of ['fontFamily', 'fontSize', 'fontWeight', 'textTransform', 'color', 'lineHeight'] as const) {
      expect(button[prop]).withContext(prop).toBe(link[prop]);
    }
    // The desktop size/weight live in a (min-width: 992px) rule the test browser may be too narrow for, so also
    // check the button's own rule doesn't override them (a `font` shorthand there made MEMBERSHIP 18px / 400).
    const toggleRule = Array.from(document.styleSheets)
      .flatMap(sheet => { try { return Array.from(sheet.cssRules); } catch { return []; } })
      .find((r): r is CSSStyleRule => r instanceof CSSStyleRule && /membership-menu[^,]*\.dropdown-toggle/.test(r.selectorText));
    expect(toggleRule).toBeDefined();
    expect(toggleRule!.style.fontSize).toBe('');
    expect(toggleRule!.style.fontWeight).toBe('');
    el.remove();
  });

  it('labels the about-1-5-1 page "ABOUT" (other pages keep their slug)', async () => {
    TestBed.inject(HttpTestingController); // same instance
    http.expectOne(r => r.url.startsWith(environment.restUrl + 'pages?_embed'))
      .flush([{ id: 19, slug: 'about-1-5-1', title: { rendered: '1-5-1 History' } },
              { id: 17, slug: 'moto', title: { rendered: 'Moto' } }]);
    fixture.detectChanges();
    await fixture.whenStable();
    const items = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.navbar-nav.mr-auto > li > .nav-link'));
    expect(items.map(a => a.textContent?.trim())).toEqual(['HOME', 'ABOUT', 'MOTO', 'MEMBERSHIP']);
    expect(items[1].getAttribute('href')).toBe('/pg/about-1-5-1');
  });

  it('is a regular horizontal menu on desktop (navbar-expand-lg: hamburger only below 992px)', () => {
    http.expectOne(r => r.url.startsWith(environment.restUrl + 'pages?_embed')).flush([]);
    const nav = (fixture.nativeElement as HTMLElement).querySelector('nav#header')!;
    expect(nav.classList).toContain('navbar-expand-lg');
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
    const items = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.navbar-nav.mr-auto > li > .nav-link'));
    expect(items.map(a => a.textContent?.trim())).toEqual(['HOME', 'MOTO', 'MEMBERSHIP']);
    expect(items.map(a => a.getAttribute('href'))).toEqual(['/', '/pg/moto', null]);
    http.verify();
  });
});
