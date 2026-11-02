import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { FooterComponent } from './footer.component';

@Component({ template: '' }) class Blank {}

describe('FooterComponent', () => {
  let fixture: ComponentFixture<FooterComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FooterComponent],
      providers: [provideRouter([{ path: '', component: Blank }, { path: ':slug', component: Blank }]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(FooterComponent);
    fixture.detectChanges();
  });

  it('shows Upcoming Events right under the motto band, then the blog carousel, on the homepage only', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    fixture.detectChanges();
    const events = el().querySelector('app-events');
    expect(events).not.toBeNull();
    expect(events!.previousElementSibling?.classList).toContain('motto');
    expect(events!.nextElementSibling?.tagName.toLowerCase()).toBe('app-blog-carousel');
    expect(events!.nextElementSibling!.nextElementSibling?.classList).toContain('footer-columns');

    await router.navigateByUrl('/membership');
    fixture.detectChanges();
    expect(el().querySelector('app-events')).toBeNull();
    expect(el().querySelector('app-blog-carousel')).toBeNull();
  });

  it('keeps the motto band', () => {
    expect(el().querySelector('.motto')?.textContent).toContain('Perseverance Even In The Face Of Darkness');
  });

  it('has four columns: brand, Contact Us, Quick Links, Follow Us (4 across from lg, 2 on tablets, stacked on phones)', () => {
    const cols = Array.from(el().querySelectorAll('.footer-columns .row > div'));
    expect(cols.length).toBe(4);
    cols.forEach(c => expect(c.className).toContain('col-12 col-md-6 col-lg-3'));
    const headings = Array.from(el().querySelectorAll('.footer-columns h5')).map(h => h.textContent?.trim());
    expect(headings).toEqual(['Contact Us', 'Quick Links', 'Follow Us']);
  });

  it('quick links go to the slug pages', () => {
    const hrefs = Array.from(el().querySelectorAll('.quick-links a')).map(a => a.getAttribute('href'));
    expect(hrefs).toEqual(['/', '/about-1-5-1', '/membership', '/scholarship', '/foundation', '/president']);
  });

  it('social links are real links that open safely in a new tab', () => {
    const social = Array.from(el().querySelectorAll('.social a')) as HTMLAnchorElement[];
    expect(social.map(a => a.getAttribute('aria-label'))).toEqual(['Facebook', 'Instagram', 'X (Twitter)', 'Email']);
    social.filter(a => a.target === '_blank').forEach(a => expect(a.rel).toContain('noopener'));
  });

  it('shows the current year in the copyright (was hard-coded 2018)', () => {
    expect(el().querySelector('.copyright')?.textContent).toContain(String(new Date().getFullYear()));
  });

  it('keeps "1 - 5 - 1 Incorporated" and the tagline each on one line, sized to the column', () => {
    document.body.appendChild(el());
    const col = el().querySelector('.footer-brand') as HTMLElement;
    const inner = col.clientWidth - parseFloat(getComputedStyle(col).paddingLeft) - parseFloat(getComputedStyle(col).paddingRight);
    for (const sel of ['h4', 'p']) {
      const e = col.querySelector(sel) as HTMLElement;
      expect(getComputedStyle(e).whiteSpace).withContext(sel).toBe('nowrap');
      const range = document.createRange();
      range.selectNodeContents(e);
      const rects = Array.from(range.getClientRects());
      expect(new Set(rects.map(r => Math.round(r.top))).size).withContext(sel + ' lines').toBe(1);
      expect(Math.max(...rects.map(r => r.width))).withContext(sel + ' width').toBeLessThanOrEqual(inner + 1);
    }
    // The tagline keeps clear of column 2: at most ~90% of its column.
    const range = document.createRange();
    range.selectNodeContents(col.querySelector('p')!);
    expect(Math.max(...Array.from(range.getClientRects()).map(r => r.width))).toBeLessThanOrEqual(inner * 0.9);
    // ...and is never larger than 0.8rem (12.8px), whatever the column width.
    expect(parseFloat(getComputedStyle(col.querySelector('p')!).fontSize)).toBeLessThanOrEqual(12.8);
    el().remove();
  });

  it('uses the Collegiate Heritage fonts: italic Newsreader motto, Work Sans column titles; colours unchanged', () => {
    const root = fixture.nativeElement as HTMLElement;
    document.body.appendChild(root);
    const motto = getComputedStyle(root.querySelector('.motto h2')!);
    expect(motto.fontFamily).toContain('Newsreader');
    expect(motto.fontStyle).toBe('italic');
    expect(getComputedStyle(root.querySelector('h5')!).fontFamily).toContain('Work Sans');
    expect(getComputedStyle(root.querySelector('footer.footer')!).backgroundColor).toBe('rgb(103, 0, 1)');
    root.remove();
  });

  it('Contact Us shows only info@brothersof1-5-1.org (no P.O. Box), and the email icon uses the same address', () => {
    const contact = Array.from(el().querySelectorAll('.footer-columns .row > div')).find(c => c.querySelector('h5')?.textContent === 'Contact Us')!;
    expect(contact.textContent).toContain('info@brothersof1-5-1.org');
    expect(contact.textContent).not.toContain('P.O. Box');
    expect(contact.textContent).not.toContain('Hampton, VA');
    const mailtos = Array.from(el().querySelectorAll('a[href^="mailto:"]')).map(a => a.getAttribute('href'));
    expect(mailtos).toEqual(['mailto:info@brothersof1-5-1.org', 'mailto:info@brothersof1-5-1.org']);
  });
});
