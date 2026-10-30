import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { HistoryComponent } from './history.component';

describe('HistoryComponent', () => {
  let fixture: ComponentFixture<HistoryComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoryComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(HistoryComponent);
    fixture.detectChanges();
  });

  it('shows the 1-5-1 shield with alt text', () => {
    const img = el().querySelector('img.shield') as HTMLImageElement;
    expect(img.getAttribute('src')).toContain('shield-history.png');
    expect(img.alt).toContain('1-5-1');
  });

  it('tells the history: founded March 6, 1982 at the Bismarck Hotel in Chicago, motto and creed', () => {
    const text = el().textContent ?? '';
    expect(el().querySelector('h2')?.textContent).toContain('The Brothers of 1-5-1, Incorporated');
    for (const fact of ['March 6, 1982', 'Bismarck Hotel', 'Chicago', 'Hampton', 'Perseverance Even in the Face of Darkness', 'Integrity and Achievement']) {
      expect(text).withContext(fact).toContain(fact);
    }
  });

  it('links to the full history page', () => {
    expect(el().querySelector('a.history-link')?.getAttribute('href')).toBe('/pg/about-1-5-1');
  });

  it('puts the shield beside the text from 768px (col-md-4 / col-md-8) and stacks on phones', () => {
    const cols = Array.from(el().querySelectorAll('.history .row > div')).map(c => c.className);
    expect(cols[0]).toContain('col-12 col-md-4');
    expect(cols[1]).toContain('col-12 col-md-8');
  });

  it('has the maroon accent rules', () => {
    expect(el().querySelector('.rule-top')).not.toBeNull();
    expect(el().querySelector('.rule-bottom')).not.toBeNull();
  });

  it('uses the Collegiate Heritage fonts (Newsreader) without changing colours', () => {
    document.body.appendChild(el());
    expect(getComputedStyle(el().querySelector('h2')!).fontFamily).toContain('Newsreader');
    expect(getComputedStyle(el().querySelector('p')!).fontFamily).toContain('Newsreader');
    expect(getComputedStyle(el().querySelector('.rule-top')!).backgroundColor).toBe('rgb(103, 0, 1)'); // colour unchanged
    el().remove();
  });
});
