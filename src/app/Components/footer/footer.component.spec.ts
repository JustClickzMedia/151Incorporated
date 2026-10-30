import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FooterComponent } from './footer.component';

describe('FooterComponent', () => {
  let fixture: ComponentFixture<FooterComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FooterComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(FooterComponent);
    fixture.detectChanges();
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
    expect(hrefs).toEqual(['/', '/pg/about-1-5-1', '/pg/membership', '/pg/scholarship', '/pg/foundation', '/pg/president']);
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
    el().remove();
  });
});
