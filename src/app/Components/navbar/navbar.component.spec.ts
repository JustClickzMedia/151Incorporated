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

  it('menu order: HOME first, then the WordPress pages, UPDATE, then MEMBERSHIP last', async () => {
    http.expectOne(r => r.url.startsWith(environment.restUrl + 'pages?_embed'))
      .flush([{ id: 2, slug: 'membership', title: { rendered: 'Membership' } },
              { id: 3, slug: 'gallery', title: { rendered: 'Gallery' } }]);
    fixture.detectChanges();
    await fixture.whenStable();
    const items = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.navbar-nav.mr-auto > li > .nav-link'));
    expect(items.map(a => a.textContent?.trim())).toEqual(['HOME', 'GALLERY', 'UPDATE', 'MEMBERSHIP']);
    expect(items.map(a => a.getAttribute('href'))).toEqual(['/', '/gallery', null, null]); // UPDATE and MEMBERSHIP are dropdown buttons
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
    expect(items.map(a => a.textContent?.trim())).toEqual(['Membership Requirements', 'Pay Dues', 'Member Sign In']);
    expect(items[2].getAttribute('href')).toBe('/members/sign-in');
    expect(items[0].getAttribute('href')).toBe('/membership');
    expect(items[1].href).toContain('checkout.square.site');

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
      .flush([{ id: 3, slug: 'gallery', title: { rendered: 'Gallery' } }]);
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

  it('Pay Dues opens the Square checkout in a pop-up frame on this site (no navigation, no new tab)', async () => {
    http.expectOne(r => r.url.startsWith(environment.restUrl + 'pages?_embed')).flush([]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('#membership-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    const payDues = Array.from(el.querySelectorAll('#membership-menu a')).find(a => a.textContent?.trim() === 'Pay Dues') as HTMLAnchorElement;
    expect(payDues.target).toBe('');                     // not a new tab

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    payDues.dispatchEvent(click);
    fixture.detectChanges();
    expect(click.defaultPrevented).toBeTrue();           // the browser does not leave the site
    const frame = el.querySelector('.paydues-modal iframe') as HTMLIFrameElement;
    expect(frame).not.toBeNull();
    expect(frame.src).toContain('checkout.square.site/merchant/4ZBJEDVN0C8CN');
    expect(el.querySelector('.paydues-modal')?.getAttribute('role')).toBe('dialog');
    expect(document.body.classList).toContain('modal-open');
    expect(el.querySelector('#membership-menu')!.classList).not.toContain('show');

    (el.querySelector('.paydues-modal .btn-close') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.paydues-modal')).toBeNull();
    expect(document.body.classList).not.toContain('modal-open');

    payDues.click();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el.querySelector('.paydues-modal')).toBeNull();   // Escape closes it too
  });

  it('UPDATE opens a dropdown with Events (/events) and Blog (/blog); only one dropdown is open at a time', async () => {
    http.expectOne(r => r.url.startsWith(environment.restUrl + 'pages?_embed')).flush([]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const update = el.querySelector('#update-toggle') as HTMLButtonElement;
    const membership = el.querySelector('#membership-toggle') as HTMLButtonElement;
    expect(update.textContent?.trim()).toBe('UPDATE');
    update.click();
    fixture.detectChanges();
    const items = Array.from(el.querySelectorAll('#update-menu a'));
    expect(items.map(a => a.textContent?.trim())).toEqual(['Events', 'Blog']);
    expect(items.map(a => a.getAttribute('href'))).toEqual(['/events', '/blog']);
    expect(el.querySelector('#update-menu')!.classList).toContain('show');
    expect(update.getAttribute('aria-expanded')).toBe('true');

    membership.click();
    fixture.detectChanges();
    expect(el.querySelector('#update-menu')!.classList).not.toContain('show');
    expect(el.querySelector('#membership-menu')!.classList).toContain('show');

    update.click();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el.querySelector('#update-menu')!.classList).not.toContain('show');
  });

  it('labels the president page "LEADERSHIP"', async () => {
    http.expectOne(r => r.url.startsWith(environment.restUrl + 'pages?_embed'))
      .flush([{ id: 13, slug: 'president', title: { rendered: "President's Message" } }]);
    fixture.detectChanges();
    await fixture.whenStable();
    const items = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.navbar-nav.mr-auto > li > .nav-link'));
    expect(items.map(a => a.textContent?.trim())).toEqual(['HOME', 'LEADERSHIP', 'UPDATE', 'MEMBERSHIP']);
    expect(items[1].getAttribute('href')).toBe('/president');
  });

  it('groups About + Moto under ABOUT and Scholarship + Foundation under IMPACT', async () => {
    // The live WordPress page order: Foundation, Scholarship, Moto, About, President, Membership.
    http.expectOne(r => r.url.startsWith(environment.restUrl + 'pages?_embed'))
      .flush([{ id: 10, slug: 'foundation', title: { rendered: 'THE HELP THEM WE WILL FOUNDATION' } },
              { id: 15, slug: 'scholarship', title: { rendered: 'The Michael J. Bryant Memorial Scholarship' } },
              { id: 17, slug: 'moto', title: { rendered: 'Perseverance' } },
              { id: 19, slug: 'about-1-5-1', title: { rendered: '1-5-1 History' } },
              { id: 27, slug: 'president', title: { rendered: 'Message from the National President' } },
              { id: 29, slug: 'membership', title: { rendered: 'Membership Requirement' } }]);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const top = Array.from(el.querySelectorAll('.navbar-nav.mr-auto > li > .nav-link'));
    expect(top.map(a => a.textContent?.trim())).toEqual(['HOME', 'LEADERSHIP', 'ABOUT', 'IMPACT', 'UPDATE', 'MEMBERSHIP']);

    const impact = el.querySelector('#impact-toggle') as HTMLButtonElement;
    const about = el.querySelector('#about-toggle') as HTMLButtonElement;
    expect(el.querySelector('#impact-menu')!.classList).not.toContain('show');
    impact.click();
    fixture.detectChanges();
    expect(impact.getAttribute('aria-expanded')).toBe('true');
    const impactItems = Array.from(el.querySelectorAll('#impact-menu a'));
    expect(impactItems.map(a => a.textContent?.trim())).toEqual(['Scholarship', 'Foundation']);
    expect(impactItems.map(a => a.getAttribute('href'))).toEqual(['/scholarship', '/foundation']);

    about.click();                       // only one dropdown open at a time
    fixture.detectChanges();
    expect(el.querySelector('#impact-menu')!.classList).not.toContain('show');
    const aboutItems = Array.from(el.querySelectorAll('#about-menu a'));
    expect(aboutItems.map(a => a.textContent?.trim())).toEqual(['About 1-5-1', 'Moto']);
    expect(aboutItems.map(a => a.getAttribute('href'))).toEqual(['/about-1-5-1', '/moto']);

    about.click();                       // clicking again closes it
    fixture.detectChanges();
    expect(el.querySelector('#about-menu')!.classList).not.toContain('show');

    impact.click();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el.querySelector('#impact-menu')!.classList).not.toContain('show');
  });

  it('puts LEADERSHIP right after HOME, then ABOUT, then PROGRAMS (Education, Social Action) right after ABOUT, whatever order WordPress returns the pages in', async () => {
    // New pages come back last from WordPress (all pages have Order 0); an unlisted page goes after the fixed ones.
    http.expectOne(r => r.url.startsWith(environment.restUrl + 'pages?_embed'))
      .flush([{ id: 27, slug: 'president', title: { rendered: 'Message from the National President' } },
              { id: 31, slug: 'gallery', title: { rendered: 'Gallery' } },
              { id: 19, slug: 'about-1-5-1', title: { rendered: '1-5-1 History' } },
              { id: 10, slug: 'foundation', title: { rendered: 'Foundation' } },
              { id: 200, slug: 'social-action', title: { rendered: 'Social Action &#038; Community Impact' } },
              { id: 196, slug: 'education', title: { rendered: 'Education' } }]);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(Array.from(el.querySelectorAll('.navbar-nav.mr-auto > li > .nav-link')).map(a => a.textContent?.trim()))
      .toEqual(['HOME', 'LEADERSHIP', 'ABOUT', 'PROGRAMS', 'IMPACT', 'GALLERY', 'UPDATE', 'MEMBERSHIP']);
    (el.querySelector('#programs-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    const items = Array.from(el.querySelectorAll('#programs-menu a'));
    expect(items.map(a => a.textContent?.trim())).toEqual(['Education', 'Social Action']);
    expect(items.map(a => a.getAttribute('href'))).toEqual(['/education', '/social-action']);
  });

  it('shows a group with only the pages that exist, and no group when none do', async () => {
    http.expectOne(r => r.url.startsWith(environment.restUrl + 'pages?_embed'))
      .flush([{ id: 15, slug: 'scholarship', title: { rendered: 'Scholarship' } }]);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(Array.from(el.querySelectorAll('.navbar-nav.mr-auto > li > .nav-link')).map(a => a.textContent?.trim()))
      .toEqual(['HOME', 'IMPACT', 'UPDATE', 'MEMBERSHIP']);
    expect(Array.from(el.querySelectorAll('#impact-menu a')).map(a => a.textContent?.trim())).toEqual(['Scholarship']);
    expect(el.querySelector('#about-toggle')).toBeNull();
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
              { databaseId: 17, slug: 'gallery', title: 'Gallery', uri: '/gallery/' }] } } });
    fixture.detectChanges();
    await fixture.whenStable();
    const items = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.navbar-nav.mr-auto > li > .nav-link'));
    expect(items.map(a => a.textContent?.trim())).toEqual(['HOME', 'GALLERY', 'UPDATE', 'MEMBERSHIP']);
    expect(items.map(a => a.getAttribute('href'))).toEqual(['/', '/gallery', null, null]);
    http.verify();
  });
});
